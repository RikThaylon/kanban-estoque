const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize, podeAprovarNivel1, podeAprovarNivel2, podeAprovarNivel3 } = require('../middleware/rbac');
const { audit } = require('../middleware/audit');
const { createLimiter } = require('../middleware/rateLimiter');
const { query, getClient } = require('../config/database');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { NotFoundError, AppError } = require('../utils/errors');
const { recalcularKanban } = require('../services/kanban.calc');
const { dispatchRecalculoKanban } = require('../services/recalculo.dispatcher');
const { getLimitesAprovacaoPedido } = require('../services/configuracoes.service');
const {
  determinarStatusInicialPedido,
  determinarProximaAprovacao,
  resolverVinculoMaquina,
} = require('../services/pedido.workflow');
const { format } = require('date-fns');
const logger = require('../utils/logger');

const router = express.Router();

// Gera número sequencial PC-YYYYMM-NNNN
async function gerarNumeroPedido() {
  const prefix = `PC-${format(new Date(), 'yyyyMM')}`;
  const result = await query(
    `SELECT numero FROM pedidos_compra WHERE numero LIKE $1 ORDER BY numero DESC LIMIT 1`,
    [`${prefix}%`]
  );
  const lastNum = result.rows[0] ? parseInt(result.rows[0].numero.split('-')[2]) : 0;
  return `${prefix}-${String(lastNum + 1).padStart(4, '0')}`;
}

// Transições válidas de status
function podeAlterarStatusPedido(perfil, novoStatus) {
  if (perfil === 'admin') return true;
  if (['CANCELADO', 'REJEITADO'].includes(novoStatus)) return podeAprovarNivel1(perfil);
  if (['EMITIDO', 'EM_TRANSITO'].includes(novoStatus)) return perfil === 'comprador';
  if (['RECEBIDO', 'RECEBIDO_PARCIAL'].includes(novoStatus)) return ['gerente_operacoes', 'supervisor_turno', 'comprador', 'facilitador'].includes(perfil);
  return false;
}

const TRANSICOES = {
  // Admin/supervisor/gerente podem dispensar aprovação e emitir direto a partir do rascunho
  'RASCUNHO': ['AGUARDANDO_APROVACAO', 'AGUARDANDO_GERENTE', 'AGUARDANDO_DIRETORIA', 'APROVADO', 'CANCELADO'],
  'AGUARDANDO_APROVACAO': ['AGUARDANDO_GERENTE', 'AGUARDANDO_DIRETORIA', 'APROVADO', 'CANCELADO', 'REJEITADO'],
  'AGUARDANDO_GERENTE': ['AGUARDANDO_DIRETORIA', 'APROVADO', 'CANCELADO', 'REJEITADO'],
  'AGUARDANDO_DIRETORIA': ['APROVADO', 'CANCELADO', 'REJEITADO'],
  'APROVADO': ['EMITIDO', 'CANCELADO'],
  'EMITIDO': ['EM_TRANSITO', 'RECEBIDO_PARCIAL', 'RECEBIDO', 'CANCELADO'],
  'EM_TRANSITO': ['RECEBIDO_PARCIAL', 'RECEBIDO', 'CANCELADO'],
  'RECEBIDO_PARCIAL': ['RECEBIDO', 'CANCELADO'],
  'RECEBIDO': [],
  'CANCELADO': [],
  'REJEITADO': [],
};

// GET /api/v1/pedidos
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { limit, offset, page } = parsePagination(req.query);
    const { status, produto_id, fornecedor_id, data_inicio, data_fim } = req.query;
    let where = []; const params = []; let idx = 1;

    if (status) { where.push(`pc.status = $${idx++}`); params.push(status); }
    if (produto_id) { where.push(`pc.produto_id = $${idx++}`); params.push(produto_id); }
    if (fornecedor_id) { where.push(`pc.fornecedor_id = $${idx++}`); params.push(fornecedor_id); }
    if (data_inicio) { where.push(`pc.criado_em >= $${idx++}`); params.push(data_inicio); }
    if (data_fim) { where.push(`pc.criado_em <= $${idx++}`); params.push(data_fim); }

    const whereStr = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
    const countRes = await query(`SELECT COUNT(*) FROM pedidos_compra pc ${whereStr}`, params);
    const total = parseInt(countRes.rows[0].count);

    const dataRes = await query(
      `SELECT pc.*, p.nome AS produto_nome, p.codigo AS produto_codigo, f.nome AS fornecedor_nome,
              m.codigo AS maquina_codigo, m.nome AS maquina_nome,
              d.codigo AS departamento_codigo, d.nome AS departamento_nome,
              us.nome AS aprovador_n1_nome
       FROM pedidos_compra pc
       LEFT JOIN produtos p ON p.id = pc.produto_id
       LEFT JOIN fornecedores f ON f.id = pc.fornecedor_id
       LEFT JOIN maquinas m ON m.id = pc.maquina_id
       LEFT JOIN departamentos d ON d.id = pc.departamento_id
       LEFT JOIN usuarios us ON us.id = pc.aprovador_n1_id
       ${whereStr} ORDER BY pc.criado_em DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    );

    res.json(paginatedResponse(dataRes.rows, total, page, limit));
  } catch (err) { next(err); }
});

// GET /api/v1/pedidos/sugestoes
router.get('/sugestoes', authenticate, async (req, res, next) => {
  try {
    const result = await query(`
      SELECT p.id, p.codigo, p.nome, p.estoque_atual, p.custo_unitario,
             kp.faixa_atual, kp.eoq, kp.ponto_reposicao, kp.estoque_seguranca, kp.demanda_diaria_media,
             pf.fornecedor_id, f.nome AS fornecedor_nome, pf.preco_acordado, pf.lead_time_nominal_dias,
             CASE WHEN kp.demanda_diaria_media > 0
               THEN ROUND(((p.estoque_atual - kp.estoque_seguranca) / kp.demanda_diaria_media)::NUMERIC, 1)
               ELSE NULL END AS dias_cobertura
      FROM produtos p
      JOIN kanban_parametros kp ON kp.produto_id = p.id
      LEFT JOIN LATERAL (
        SELECT *
        FROM produto_fornecedor pfx
        WHERE pfx.produto_id = p.id AND pfx.ativo = true
        ORDER BY pfx.lead_time_nominal_dias ASC NULLS LAST, pfx.prioridade ASC
        LIMIT 1
      ) pf ON true
      LEFT JOIN fornecedores f ON f.id = pf.fornecedor_id
      WHERE p.ativo = true AND kp.faixa_atual IN ('AMARELO', 'VERMELHO')
      ORDER BY
        CASE kp.faixa_atual WHEN 'VERMELHO' THEN 0 WHEN 'AMARELO' THEN 1 END,
        CASE WHEN kp.demanda_diaria_media > 0
          THEN (p.estoque_atual - kp.estoque_seguranca) / kp.demanda_diaria_media
          ELSE 999 END ASC
    `);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/v1/pedidos — comprador, facilitador, supervisor, gerente, admin podem criar
router.post('/', authenticate,
  authorize('admin', 'gerente_operacoes', 'supervisor_turno', 'comprador', 'facilitador'),
  createLimiter, audit('CRIAR_PEDIDO', 'pedidos_compra'),
  [
    body('produto_id').matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).withMessage('produto_id inválido'),
    body('fornecedor_id').optional({ nullable: true, checkFalsy: true }).matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).withMessage('fornecedor_id invalido'),
    body('maquina_id').optional({ nullable: true, checkFalsy: true }).matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).withMessage('maquina_id inválido'),
    body('departamento_id').optional({ nullable: true, checkFalsy: true }).matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).withMessage('departamento_id inválido'),
    body('quantidade_pedida').isFloat({ gt: 0 }),
    body('preco_unitario').optional().isFloat({ min: 0 }),
    body('data_prevista').optional().isISO8601(),
  ], validate,
  async (req, res, next) => {
    try {
      const {
        produto_id,
        fornecedor_id,
        quantidade_pedida,
        preco_unitario,
        data_prevista,
        departamento_id,
        maquina_id,
      } = req.body;
      const numero = await gerarNumeroPedido();
      const quantidadePedido = Number(quantidade_pedida);
      let fornecedorPedidoId = fornecedor_id || null;
      let precoPedido = preco_unitario !== undefined && preco_unitario !== null ? Number(preco_unitario) : null;

      if (fornecedor_id && !['admin', 'comprador'].includes(req.user.perfil)) {
        throw new AppError('Apenas comprador escolhe fornecedor da solicitacao', 403, 'FORNECEDOR_RESTRITO_COMPRADOR');
      }

      const kpRes = await query('SELECT faixa_atual, ponto_reposicao FROM kanban_parametros WHERE produto_id = $1', [produto_id]);
      const prodRes = await query('SELECT estoque_atual, custo_unitario FROM produtos WHERE id = $1', [produto_id]);
      if (prodRes.rows.length === 0) throw new NotFoundError('Produto');

      if (!fornecedorPedidoId) {
        const fornecedorRes = await query(`
          SELECT pf.fornecedor_id, pf.preco_acordado
          FROM produto_fornecedor pf
          JOIN fornecedores f ON f.id = pf.fornecedor_id AND f.ativo = true
          WHERE pf.produto_id = $1 AND pf.ativo = true
          ORDER BY pf.prioridade ASC, pf.lead_time_nominal_dias ASC NULLS LAST
          LIMIT 1
        `, [produto_id]);

        fornecedorPedidoId = fornecedorRes.rows[0]?.fornecedor_id || null;
        if (precoPedido === null && fornecedorRes.rows[0]?.preco_acordado !== undefined) {
          precoPedido = Number(fornecedorRes.rows[0].preco_acordado);
        }
      }

      if (precoPedido === null && prodRes.rows[0]?.custo_unitario !== undefined) {
        precoPedido = Number(prodRes.rows[0].custo_unitario);
      }

      const custoTotal = precoPedido !== null ? precoPedido * quantidadePedido : null;

      // Roteamento por maquina: item em N maquinas exige escolha explicita.
      const maquinasRes = await query(`
        SELECT m.id AS maquina_id, m.codigo AS maquina_codigo, m.nome AS maquina_nome,
               m.departamento_id, d.supervisor_id
        FROM maquina_produto mp
        JOIN maquinas m ON m.id = mp.maquina_id AND m.ativo = true
        LEFT JOIN departamentos d ON d.id = m.departamento_id AND d.ativo = true
        WHERE mp.produto_id = $1
        ORDER BY m.nome ASC
      `, [produto_id]);
      const vinculoMaquina = resolverVinculoMaquina({
        maquinasDoProduto: maquinasRes.rows,
        maquinaId: maquina_id || null,
      });

      if (!vinculoMaquina) {
        throw new AppError('Produto sem maquina vinculada. Vincule o item a uma maquina antes de criar a solicitacao.', 400, 'MAQUINA_OBRIGATORIA');
      }

      const deptId = vinculoMaquina.departamento_id || departamento_id || null;
      const aprovadorN1Id = vinculoMaquina.supervisor_id || null;
      const limites = await getLimitesAprovacaoPedido();

      // Status inicial vem dos limites configuraveis pelo admin.
      const status = determinarStatusInicialPedido({
        perfil: req.user.perfil,
        custoTotal,
        limites,
      });

      const result = await query(
        `INSERT INTO pedidos_compra (numero, produto_id, fornecedor_id, quantidade_pedida, preco_unitario, custo_total, status, faixa_no_momento, estoque_no_momento, pr_no_momento, data_prevista, departamento_id, maquina_id, aprovador_n1_id, criado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [numero, produto_id, fornecedorPedidoId, quantidadePedido, precoPedido, custoTotal, status,
         kpRes.rows[0]?.faixa_atual, prodRes.rows[0]?.estoque_atual, kpRes.rows[0]?.ponto_reposicao,
         data_prevista, deptId, vinculoMaquina.maquina_id, aprovadorN1Id, req.user.id]
      );

      const io = req.app.get('io');
      if (io && status !== 'RASCUNHO') {
        io.emit('pedido:status', {
          pedido_id: result.rows[0].id,
          numero: result.rows[0].numero,
          status_novo: status,
          departamento_id: deptId,
        });
      }

      res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

// POST /api/v1/pedidos/:id/aprovar
// Fluxo usa limites configuraveis em configuracoes_sistema.
router.post('/:id/aprovar', authenticate, audit('APROVAR_PEDIDO', 'pedidos_compra'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const pedRes = await query('SELECT * FROM pedidos_compra WHERE id = $1', [id]);
      if (pedRes.rows.length === 0) throw new NotFoundError('Pedido');

      const pedido = pedRes.rows[0];
      if (!['AGUARDANDO_APROVACAO', 'AGUARDANDO_GERENTE', 'AGUARDANDO_DIRETORIA'].includes(pedido.status)) {
        throw new AppError(`Pedido não está aguardando aprovação (status atual: ${pedido.status})`, 400, 'STATUS_INVALIDO');
      }

      const limites = await getLimitesAprovacaoPedido();
      const decisao = determinarProximaAprovacao({
        pedido,
        usuario: req.user,
        limites,
      });

      const result = decisao.novoStatus === 'APROVADO'
        ? await query(
          `UPDATE pedidos_compra
           SET status = 'APROVADO', aprovado_por = $1, atualizado_em = NOW()
           WHERE id = $2 RETURNING *`,
          [decisao.aprovadoPor, id]
        )
        : await query(
          `UPDATE pedidos_compra
           SET status = $1, escalado_em = NOW(), atualizado_em = NOW()
           WHERE id = $2 RETURNING *`,
          [decisao.novoStatus, id]
        );

      const io = req.app.get('io');
      if (io) io.emit('pedido:status', { pedido_id: id, numero: result.rows[0].numero, status_novo: decisao.novoStatus });

      res.json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

// POST /api/v1/pedidos/:id/rejeitar
router.post('/:id/rejeitar', authenticate, audit('REJEITAR_PEDIDO', 'pedidos_compra'),
  [body('motivo').isString().trim().isLength({ min: 5, max: 1000 }).withMessage('Motivo deve ter 5-1000 caracteres')],
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { motivo } = req.body;

      const pedRes = await query('SELECT status, criado_por, aprovador_n1_id FROM pedidos_compra WHERE id = $1', [id]);
      if (pedRes.rows.length === 0) throw new NotFoundError('Pedido');
      const ped = pedRes.rows[0];

      if (!['AGUARDANDO_APROVACAO', 'AGUARDANDO_GERENTE', 'AGUARDANDO_DIRETORIA'].includes(ped.status)) {
        throw new AppError(`Pedido não pode ser rejeitado neste status: ${ped.status}`, 400, 'STATUS_INVALIDO');
      }

      if (ped.status === 'AGUARDANDO_APROVACAO' && !podeAprovarNivel1(req.user.perfil)) {
        throw new AppError('Necessário Supervisor de Turno ou superior', 403, 'FORBIDDEN');
      }
      if (
        ped.status === 'AGUARDANDO_APROVACAO'
        && req.user.perfil === 'supervisor_turno'
        && ped.aprovador_n1_id
        && ped.aprovador_n1_id !== req.user.id
      ) {
        throw new AppError('Rejeicao restrita ao supervisor responsavel pelo departamento', 403, 'SUPERVISOR_RESPONSAVEL');
      }
      if (ped.status === 'AGUARDANDO_GERENTE' && !podeAprovarNivel2(req.user.perfil)) {
        throw new AppError('Necessário Gerente de Operações ou superior', 403, 'FORBIDDEN');
      }
      if (ped.status === 'AGUARDANDO_DIRETORIA' && !podeAprovarNivel3(req.user.perfil)) {
        throw new AppError('Necessário Plant Manager ou superior', 403, 'FORBIDDEN');
      }

      const result = await query(
        `UPDATE pedidos_compra SET status = 'REJEITADO', rejeitado_por = $1,
           rejeitado_em = NOW(), motivo_rejeicao = $2, atualizado_em = NOW()
         WHERE id = $3 RETURNING *`,
        [req.user.id, motivo, id]
      );

      const io = req.app.get('io');
      if (io) io.emit('pedido:status', { pedido_id: id, numero: result.rows[0].numero, status_novo: 'REJEITADO' });

      res.json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

// GET /api/v1/pedidos/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT pc.*, p.nome AS produto_nome, p.codigo AS produto_codigo,
              f.nome AS fornecedor_nome, f.cnpj AS fornecedor_cnpj,
              m.codigo AS maquina_codigo, m.nome AS maquina_nome,
              d.nome AS departamento_nome, d.codigo AS departamento_codigo,
              u1.nome AS criado_por_nome, u2.nome AS aprovado_por_nome,
              u3.nome AS rejeitado_por_nome, us.nome AS aprovador_n1_nome
       FROM pedidos_compra pc
       LEFT JOIN produtos p ON p.id = pc.produto_id
       LEFT JOIN fornecedores f ON f.id = pc.fornecedor_id
       LEFT JOIN maquinas m ON m.id = pc.maquina_id
       LEFT JOIN departamentos d ON d.id = pc.departamento_id
       LEFT JOIN usuarios u1 ON u1.id = pc.criado_por
       LEFT JOIN usuarios u2 ON u2.id = pc.aprovado_por
       LEFT JOIN usuarios u3 ON u3.id = pc.rejeitado_por
       LEFT JOIN usuarios us ON us.id = pc.aprovador_n1_id
       WHERE pc.id = $1`, [req.params.id]
    );
    if (result.rows.length === 0) throw new NotFoundError('Pedido');
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// PATCH /api/v1/pedidos/:id/status
router.patch('/:id/status', authenticate, audit('ATUALIZAR_STATUS_PEDIDO', 'pedidos_compra'),
  [
    body('status').isString().notEmpty(),
    body('numero_oc_externa').optional().trim().isLength({ min: 1, max: 80 }),
    body('fornecedor_id').optional({ nullable: true, checkFalsy: true }).matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).withMessage('fornecedor_id invalido'),
  ], validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status: novoStatus, numero_oc_externa, fornecedor_id } = req.body;

      const pedRes = await query('SELECT status, fornecedor_id FROM pedidos_compra WHERE id = $1', [id]);
      if (pedRes.rows.length === 0) throw new NotFoundError('Pedido');

      const statusAtual = pedRes.rows[0].status;
      if (!TRANSICOES[statusAtual]?.includes(novoStatus)) {
        throw new AppError(`Transição inválida: ${statusAtual} → ${novoStatus}`, 400, 'TRANSICAO_INVALIDA');
      }

      if (novoStatus === 'APROVADO' && req.user.perfil !== 'admin') {
        throw new AppError('Use POST /:id/aprovar para aprovar pedidos', 400, 'USE_APROVAR_ENDPOINT');
      }
      if (['RECEBIDO', 'RECEBIDO_PARCIAL'].includes(novoStatus)) {
        throw new AppError('Use POST /:id/receber para registrar recebimento com quantidade e NF', 400, 'USE_RECEBER_ENDPOINT');
      }
      if (!podeAlterarStatusPedido(req.user.perfil, novoStatus)) {
        throw new AppError('Seu perfil nao pode alterar pedido para este status', 403, 'FORBIDDEN');
      }
      if (novoStatus === 'EMITIDO') {
        if (!numero_oc_externa) {
          throw new AppError('Informe o numero da OC criada no sistema externo', 400, 'OC_EXTERNA_OBRIGATORIA');
        }
        if (!fornecedor_id && !pedRes.rows[0].fornecedor_id) {
          throw new AppError('Comprador deve escolher o fornecedor antes de marcar como emitido', 400, 'FORNECEDOR_OBRIGATORIO');
        }
      }

      let extra = '';
      const params = [novoStatus, id];
      if (novoStatus === 'EMITIDO') {
        extra = ', data_emissao = NOW(), numero_oc_externa = $3, fornecedor_id = COALESCE($4, fornecedor_id), fornecedor_escolhido_por = $5, fornecedor_escolhido_em = NOW()';
        params.push(numero_oc_externa, fornecedor_id || null, req.user.id);
      }
      if (novoStatus === 'APROVADO') {
        extra = ', aprovado_por = $3';
        params.push(req.user.id);
      }

      const result = await query(
        `UPDATE pedidos_compra SET status = $1, atualizado_em = NOW()${extra} WHERE id = $2 RETURNING *`, params
      );

      const io = req.app.get('io');
      if (io) {
        io.emit('pedido:status', { pedido_id: id, numero: result.rows[0].numero, status_novo: novoStatus });
      }

      res.json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

// POST /api/v1/pedidos/:id/receber
router.post('/:id/receber', authenticate,
  authorize('admin', 'gerente_operacoes', 'supervisor_turno', 'comprador', 'facilitador'),
  audit('RECEBER_PEDIDO', 'pedidos_compra'),
  [
    body('quantidade_recebida').isFloat({ gt: 0 }),
    body('data_recebimento').optional().isISO8601(),
    body('numero_nf').optional().trim().isLength({ max: 80 }),
  ], validate,
  async (req, res, next) => {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const { id } = req.params;
      const { quantidade_recebida, data_recebimento, numero_nf } = req.body;
      const dataReceb = data_recebimento || new Date().toISOString();

      const pedRes = await client.query('SELECT * FROM pedidos_compra WHERE id = $1 FOR UPDATE', [id]);
      if (pedRes.rows.length === 0) throw new NotFoundError('Pedido');
      const pedido = pedRes.rows[0];

      if (!['EMITIDO', 'EM_TRANSITO', 'RECEBIDO_PARCIAL'].includes(pedido.status)) {
        throw new AppError('Pedido não pode ser recebido neste status', 400, 'STATUS_INVALIDO');
      }

      const totalRecebido = parseFloat(pedido.quantidade_recebida) + parseFloat(quantidade_recebida);
      const novoStatus = totalRecebido >= parseFloat(pedido.quantidade_pedida) ? 'RECEBIDO' : 'RECEBIDO_PARCIAL';

      await client.query(
        `UPDATE pedidos_compra SET quantidade_recebida = $1, status = $2, data_recebimento = $3, atualizado_em = NOW() WHERE id = $4`,
        [totalRecebido, novoStatus, dataReceb, id]
      );

      // Criar movimentação ENTRADA + atualizar estoque (a migration 003 removeu o trigger)
      const prodRes = await client.query('SELECT estoque_atual FROM produtos WHERE id = $1 FOR UPDATE', [pedido.produto_id]);
      const estoqueAntes = parseFloat(prodRes.rows[0].estoque_atual);
      const estoqueDepois = estoqueAntes + parseFloat(quantidade_recebida);

      await client.query(
        `INSERT INTO movimentacoes (produto_id, tipo, quantidade, estoque_antes, estoque_depois, referencia, numero_documento, status, criado_por)
         VALUES ($1, 'ENTRADA', $2, $3, $4, $5, $6, 'EXECUTADO', $7)`,
        [pedido.produto_id, quantidade_recebida, estoqueAntes, estoqueDepois, `Pedido ${pedido.numero}`, numero_nf, req.user.id]
      );

      await client.query(
        'UPDATE produtos SET estoque_atual = $1, atualizado_em = NOW() WHERE id = $2',
        [estoqueDepois, pedido.produto_id]
      );

      await client.query('COMMIT');

      // Recalcular Kanban
      const io = req.app.get('io');
      dispatchRecalculoKanban(recalcularKanban, pedido.produto_id, io, logger);
      if (io) {
        io.emit('pedido:status', { pedido_id: id, numero: pedido.numero, status_novo: novoStatus });
      }

      res.json({ message: 'Recebimento registrado', status: novoStatus, quantidade_total_recebida: totalRecebido });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

module.exports = router;
