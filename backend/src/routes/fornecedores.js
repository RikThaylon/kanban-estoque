const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { audit } = require('../middleware/audit');
const { query } = require('../config/database');
const { NotFoundError, AppError } = require('../utils/errors');
const {
  MODAIS_VALIDOS,
  CAMPOS_ATUALIZAVEIS_FORNECEDOR,
  nullSeVazio,
  montarAtualizacaoFornecedor,
  erroFornecedorDoBanco,
} = require('../services/fornecedor.workflow');

const router = express.Router();

const validarFornecedor = [
  body('cnpj').optional({ checkFalsy: true }).trim().isLength({ min: 14, max: 18 }).withMessage('CNPJ deve ter entre 14 e 18 caracteres'),
  body('contato_nome').optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
  body('contato_email').optional({ checkFalsy: true }).trim().isEmail().withMessage('E-mail invalido'),
  body('contato_telefone').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  body('cidade').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('estado').optional({ checkFalsy: true }).trim().toUpperCase().matches(/^[A-Z]{2}$/).withMessage('Estado deve ser uma UF com 2 letras'),
  body('modal_padrao').optional({ checkFalsy: true }).trim().toLowerCase().isIn(MODAIS_VALIDOS).withMessage('Modal padrao invalido'),
  body('prazo_pagamento_dias').optional({ nullable: true, checkFalsy: true }).isInt({ min: 0, max: 3650 }),
  body('avaliacao').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0, max: 5 }),
  body('observacoes').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
];

function tratarErroFornecedor(err, next) {
  return next(erroFornecedorDoBanco(err) || err);
}

// ─── GET /api/v1/fornecedores ─────────────────────────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { ativo, busca } = req.query;
    const where = [];
    const params = [];
    let idx = 1;

    // Admin pode ver todos (ativo=all). Outros: apenas ativos
    if (ativo === 'all' && req.user.perfil === 'admin') {
      // sem filtro de ativo
    } else if (ativo !== undefined) {
      where.push(`f.ativo = $${idx++}`);
      params.push(ativo === 'true' || ativo === '1');
    } else {
      where.push(`f.ativo = true`);
    }

    if (busca) {
      where.push(`(f.nome ILIKE $${idx} OR f.cnpj ILIKE $${idx})`);
      params.push(`%${busca}%`);
      idx++;
    }

    const whereStr = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const result = await query(
      `SELECT f.id, f.nome, f.cnpj, f.contato_nome, f.contato_email, f.contato_telefone,
              f.cidade, f.estado, f.modal_padrao, f.prazo_pagamento_dias, f.avaliacao,
              f.ativo, f.observacoes, f.criado_em, f.atualizado_em,
              COUNT(DISTINCT pf.produto_id) AS total_produtos
       FROM fornecedores f
       LEFT JOIN produto_fornecedor pf ON pf.fornecedor_id = f.id AND pf.ativo = true
       ${whereStr}
       GROUP BY f.id
       ORDER BY f.nome ASC`,
      params
    );
    res.json(result.rows.map(r => ({
      ...r,
      total_produtos: parseInt(r.total_produtos || '0', 10),
    })));
  } catch (err) { next(err); }
});

// ─── GET /api/v1/fornecedores/:id ────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM fornecedores WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND', code: 404 });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// ─── GET /api/v1/fornecedores/:id/produtos ───────────────────────────────────
router.get('/:id/produtos', authenticate, async (req, res, next) => {
  try {
    const result = await query(`
      SELECT p.id, p.codigo, p.nome, p.unidade, p.estoque_atual, p.ativo,
             pf.prioridade, pf.preco_acordado, pf.lead_time_nominal_dias, pf.ativo AS vinculo_ativo,
             c.nome AS categoria_nome, c.cor_hex
      FROM produto_fornecedor pf
      JOIN produtos p ON p.id = pf.produto_id
      LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE pf.fornecedor_id = $1
      ORDER BY pf.prioridade ASC, p.nome ASC
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ─── GET /api/v1/fornecedores/:id/historico ──────────────────────────────────
router.get('/:id/historico', authenticate, async (req, res, next) => {
  try {
    const result = await query(`
      SELECT pc.id, pc.numero, pc.status, pc.quantidade_pedida, pc.quantidade_recebida,
             pc.preco_unitario, pc.custo_total, pc.data_emissao, pc.data_recebimento,
             pc.lead_time_real_dias, pc.criado_em,
             p.codigo AS produto_codigo, p.nome AS produto_nome
      FROM pedidos_compra pc
      JOIN produtos p ON p.id = pc.produto_id
      WHERE pc.fornecedor_id = $1
      ORDER BY pc.criado_em DESC
      LIMIT 50
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ─── POST /api/v1/fornecedores (Apenas admin) ────────────────────────────────
router.post('/', authenticate, authorize('admin'), audit('CRIAR_FORNECEDOR', 'fornecedores'),
  [
    body('nome').trim().isLength({ min: 2, max: 200 }).withMessage('Nome obrigatorio'),
    ...validarFornecedor,
  ], validate,
  async (req, res, next) => {
    try {
      const {
        nome, cnpj, contato_nome, contato_email, contato_telefone,
        cidade, estado, modal_padrao, prazo_pagamento_dias, avaliacao, observacoes,
      } = req.body;
      const result = await query(
        `INSERT INTO fornecedores (nome, cnpj, contato_nome, contato_email, contato_telefone, cidade, estado, modal_padrao, prazo_pagamento_dias, avaliacao, observacoes, criado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [
          nome,
          nullSeVazio(cnpj),
          nullSeVazio(contato_nome),
          nullSeVazio(contato_email),
          nullSeVazio(contato_telefone),
          nullSeVazio(cidade),
          nullSeVazio(estado),
          nullSeVazio(modal_padrao),
          nullSeVazio(prazo_pagamento_dias),
          nullSeVazio(avaliacao),
          nullSeVazio(observacoes),
          req.user.id,
        ]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) { tratarErroFornecedor(err, next); }
  }
);

// ─── PATCH /api/v1/fornecedores/:id (Apenas admin) ───────────────────────────
router.patch('/:id', authenticate, authorize('admin'), audit('ATUALIZAR_FORNECEDOR', 'fornecedores'),
  validarFornecedor,
  validate,
  async (req, res, next) => {
    try {
      const camposComObs = [...CAMPOS_ATUALIZAVEIS_FORNECEDOR];
      if (!camposComObs.includes('observacoes')) camposComObs.push('observacoes');

      const { fields, values, nextIndex: idx } = montarAtualizacaoFornecedor(req.body, camposComObs);
      if (fields.length === 0) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Nenhum campo', code: 400 });
      fields.push(`atualizado_em = NOW()`);
      values.push(req.params.id);

      const result = await query(`UPDATE fornecedores SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
      if (result.rows.length === 0) throw new NotFoundError('Fornecedor');
      res.json(result.rows[0]);
    } catch (err) { tratarErroFornecedor(err, next); }
  }
);

// ─── PATCH /api/v1/fornecedores/:id/reativar (Apenas admin) ──────────────────
router.patch('/:id/reativar', authenticate, authorize('admin'), audit('REATIVAR_FORNECEDOR', 'fornecedores'),
  async (req, res, next) => {
    try {
      const result = await query(
        'UPDATE fornecedores SET ativo = true, atualizado_em = NOW() WHERE id = $1 RETURNING *',
        [req.params.id]
      );
      if (result.rows.length === 0) throw new NotFoundError('Fornecedor');
      res.json({ message: 'Fornecedor reativado com sucesso', fornecedor: result.rows[0] });
    } catch (err) { next(err); }
  }
);

// ─── DELETE /api/v1/fornecedores/:id (Apenas admin) — soft delete ─────────────
router.delete('/:id', authenticate, authorize('admin'), audit('DESATIVAR_FORNECEDOR', 'fornecedores'),
  async (req, res, next) => {
    try {
      // Verificar pedidos em andamento
      const pedidosAtivos = await query(`
        SELECT COUNT(*) FROM pedidos_compra
        WHERE fornecedor_id = $1
          AND status IN ('APROVADO','EMITIDO','EM_TRANSITO','RECEBIDO_PARCIAL','AGUARDANDO_CHEGADA')
      `, [req.params.id]);

      if (parseInt(pedidosAtivos.rows[0].count) > 0) {
        throw new AppError(
          'Nao e possivel desativar um fornecedor com pedidos em andamento',
          409, 'CONFLICT'
        );
      }

      const result = await query(
        'UPDATE fornecedores SET ativo = false, atualizado_em = NOW() WHERE id = $1 RETURNING id, nome',
        [req.params.id]
      );
      if (result.rows.length === 0) throw new NotFoundError('Fornecedor');
      res.json({ message: `Fornecedor "${result.rows[0].nome}" desativado com sucesso` });
    } catch (err) { next(err); }
  }
);

module.exports = router;
