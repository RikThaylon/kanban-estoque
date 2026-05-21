const express = require('express');
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { audit } = require('../middleware/audit');
const { createLimiter } = require('../middleware/rateLimiter');
const { query, getClient } = require('../config/database');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { AppError, NotFoundError } = require('../utils/errors');
const { recalcularKanban } = require('../services/kanban.calc');
const { dispatchRecalculoKanban } = require('../services/recalculo.dispatcher');
const logger = require('../utils/logger');

const router = express.Router();

// Tipos que exigem aprovação antes de afetar o estoque
const TIPOS_REQUEREM_APROVACAO = ['AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'DEVOLUCAO'];

// Quem pode aprovar movimentações pendentes
const PERFIS_APROVADORES = ['admin', 'supervisor_turno', 'gerente_operacoes', 'plant_manager'];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function aplicarDelta(tipo, estoqueAntes, qtd) {
  switch (tipo) {
    case 'ENTRADA':
    case 'AJUSTE_POSITIVO':
    case 'DEVOLUCAO':
      return estoqueAntes + qtd;
    case 'SAIDA':
    case 'TRANSFERENCIA':
    case 'AJUSTE_NEGATIVO':
      return estoqueAntes - qtd;
    default:
      throw new AppError('Tipo de movimentação inválido', 400, 'TIPO_INVALIDO');
  }
}

// ─── GET /api/v1/movimentacoes ──────────────────────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { limit, offset, page } = parsePagination(req.query);
    const { produto_id, tipo, status, data_inicio, data_fim, criado_por } = req.query;
    const where = []; const params = []; let idx = 1;

    if (produto_id) { where.push(`m.produto_id = $${idx++}`); params.push(produto_id); }
    if (tipo) { where.push(`m.tipo = $${idx++}`); params.push(tipo); }
    if (status) { where.push(`m.status = $${idx++}`); params.push(status); }
    if (criado_por) { where.push(`m.criado_por = $${idx++}`); params.push(criado_por); }
    if (data_inicio) { where.push(`m.criado_em >= $${idx++}`); params.push(data_inicio); }
    if (data_fim) { where.push(`m.criado_em <= $${idx++}`); params.push(data_fim); }

    const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const countRes = await query(`SELECT COUNT(*) FROM movimentacoes m ${whereStr}`, params);
    const total = parseInt(countRes.rows[0].count, 10);

    const dataRes = await query(
      `SELECT m.*, p.nome AS produto_nome, p.codigo AS produto_codigo, p.unidade,
              p.custo_unitario,
              u.nome AS criado_por_nome, u.username AS criado_por_username,
              ua.nome AS aprovado_por_nome
       FROM movimentacoes m
       LEFT JOIN produtos p ON p.id = m.produto_id
       LEFT JOIN usuarios u ON u.id = m.criado_por
       LEFT JOIN usuarios ua ON ua.id = m.aprovado_por
       ${whereStr}
       ORDER BY m.criado_em DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    );

    res.json(paginatedResponse(dataRes.rows, total, page, limit));
  } catch (err) { next(err); }
});

// ─── GET /api/v1/movimentacoes/pendentes ────────────────────────────────────
router.get('/pendentes', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT m.*, p.nome AS produto_nome, p.codigo AS produto_codigo, p.unidade,
              u.nome AS criado_por_nome, u.username AS criado_por_username, u.perfil AS criado_por_perfil
       FROM movimentacoes m
       LEFT JOIN produtos p ON p.id = m.produto_id
       LEFT JOIN usuarios u ON u.id = m.criado_por
       WHERE m.status = 'PENDENTE'
       ORDER BY m.criado_em ASC
       LIMIT 200`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ─── POST /api/v1/movimentacoes ─────────────────────────────────────────────
router.post('/',
  authenticate,
  authorize('admin', 'gerente_operacoes', 'supervisor_turno', 'facilitador', 'comprador'),
  createLimiter,
  audit('CRIAR_MOVIMENTACAO', 'movimentacoes'),
  [
    body('produto_id').matches(UUID_REGEX).withMessage('produto_id inválido'),
    body('tipo').isIn(['ENTRADA', 'SAIDA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'DEVOLUCAO']),
    body('quantidade').isFloat({ gt: 0 }).withMessage('Quantidade deve ser > 0'),
    body('turno').optional({ nullable: true, checkFalsy: true }).trim().matches(/^[A-Za-z0-9_-]{1,20}$/).withMessage('Turno invalido'),
    body('referencia').optional().trim().isLength({ max: 100 }),
    body('numero_documento').optional().trim().isLength({ max: 80 }),
    body('observacao').optional().trim().isLength({ max: 1000 }),
  ],
  validate,
  async (req, res, next) => {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const { produto_id, tipo, quantidade, turno, referencia, numero_documento, observacao } = req.body;
      const qtd = parseFloat(quantidade);

      const requerAprovacao = TIPOS_REQUEREM_APROVACAO.includes(tipo);
      // Admin e supervisor_turno podem criar movimentações que precisariam aprovação
      // já no estado APROVADO (autoaprovam) — mas ainda assim preferimos PENDENTE
      // pra rastreio. Apenas operações instantâneas (ENTRADA/SAIDA) entram como EXECUTADO.

      const prodRes = await client.query(
        'SELECT estoque_atual FROM produtos WHERE id = $1 FOR UPDATE',
        [produto_id]
      );
      if (prodRes.rows.length === 0) throw new NotFoundError('Produto');

      const estoqueAntes = parseFloat(prodRes.rows[0].estoque_atual);

      if (requerAprovacao) {
        // PENDENTE: não toca em estoque ainda. Snapshot do estoque atual.
        const movRes = await client.query(
          `INSERT INTO movimentacoes
             (produto_id, tipo, quantidade, turno, estoque_antes, estoque_depois,
              referencia, numero_documento, observacao, status, criado_por)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PENDENTE',$10)
           RETURNING *`,
          [produto_id, tipo, qtd, turno || null, estoqueAntes, estoqueAntes,
           referencia, numero_documento, observacao, req.user.id]
        );
        await client.query('COMMIT');

        const io = req.app.get('io');
        if (io) io.emit('movimentacao:pendente', { movimentacao_id: movRes.rows[0].id, produto_id, tipo, quantidade: qtd });

        return res.status(201).json({ ...movRes.rows[0], aviso: 'Movimentação criada como PENDENTE. Aguarda aprovação de supervisor de turno ou superior.' });
      }

      // Tipo direto (ENTRADA/SAIDA): executa na hora
      const estoqueDepois = aplicarDelta(tipo, estoqueAntes, qtd);
      if (estoqueDepois < 0) {
        throw new AppError('Estoque insuficiente para esta operação', 400, 'ESTOQUE_INSUFICIENTE');
      }

      const movRes = await client.query(
        `INSERT INTO movimentacoes
           (produto_id, tipo, quantidade, turno, estoque_antes, estoque_depois,
            referencia, numero_documento, observacao, status, criado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'EXECUTADO',$10)
         RETURNING *`,
        [produto_id, tipo, qtd, turno || null, estoqueAntes, estoqueDepois,
         referencia, numero_documento, observacao, req.user.id]
      );

      await client.query(
        'UPDATE produtos SET estoque_atual = $1, atualizado_em = NOW() WHERE id = $2',
        [estoqueDepois, produto_id]
      );

      await client.query('COMMIT');

      const io = req.app.get('io');
      dispatchRecalculoKanban(recalcularKanban, produto_id, io, logger);
      if (io) {
        io.emit('estoque:atualizado', {
          produto_id,
          estoque_anterior: estoqueAntes,
          estoque_atual: estoqueDepois,
          tipo_movimentacao: tipo,
        });
      }

      res.status(201).json(movRes.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// ─── POST /api/v1/movimentacoes/:id/aprovar ─────────────────────────────────
router.post('/:id/aprovar',
  authenticate,
  authorize(...PERFIS_APROVADORES),
  audit('APROVAR_MOVIMENTACAO', 'movimentacoes'),
  [param('id').matches(UUID_REGEX)],
  validate,
  async (req, res, next) => {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const { id } = req.params;

      const movRes = await client.query(
        'SELECT * FROM movimentacoes WHERE id = $1 FOR UPDATE',
        [id]
      );
      if (movRes.rows.length === 0) throw new NotFoundError('Movimentação');
      const mov = movRes.rows[0];

      if (mov.status !== 'PENDENTE') {
        throw new AppError(`Movimentação não está pendente (status atual: ${mov.status})`, 409, 'STATUS_INVALIDO');
      }

      // Não permitir auto-aprovação (criador != aprovador)
      if (mov.criado_por === req.user.id && req.user.perfil !== 'admin') {
        throw new AppError('Você não pode aprovar sua própria movimentação', 403, 'AUTO_APROVACAO_PROIBIDA');
      }

      const prodRes = await client.query(
        'SELECT estoque_atual FROM produtos WHERE id = $1 FOR UPDATE',
        [mov.produto_id]
      );
      if (prodRes.rows.length === 0) throw new NotFoundError('Produto');

      const estoqueAtual = parseFloat(prodRes.rows[0].estoque_atual);
      const qtd = parseFloat(mov.quantidade);
      const estoqueDepois = aplicarDelta(mov.tipo, estoqueAtual, qtd);

      if (estoqueDepois < 0) {
        throw new AppError('Estoque insuficiente no momento da aprovação', 400, 'ESTOQUE_INSUFICIENTE');
      }

      await client.query(
        `UPDATE movimentacoes
         SET status = 'EXECUTADO',
             aprovado_por = $1,
             aprovado_em = NOW(),
             estoque_antes = $2,
             estoque_depois = $3
         WHERE id = $4`,
        [req.user.id, estoqueAtual, estoqueDepois, id]
      );

      await client.query(
        'UPDATE produtos SET estoque_atual = $1, atualizado_em = NOW() WHERE id = $2',
        [estoqueDepois, mov.produto_id]
      );

      await client.query('COMMIT');

      const io = req.app.get('io');
      dispatchRecalculoKanban(recalcularKanban, mov.produto_id, io, logger);
      if (io) {
        io.emit('movimentacao:aprovada', { movimentacao_id: id, produto_id: mov.produto_id });
        io.emit('estoque:atualizado', {
          produto_id: mov.produto_id,
          estoque_anterior: estoqueAtual,
          estoque_atual: estoqueDepois,
          tipo_movimentacao: mov.tipo,
        });
      }

      res.json({ id, status: 'EXECUTADO', estoque_atual: estoqueDepois });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }
);

// ─── POST /api/v1/movimentacoes/:id/rejeitar ────────────────────────────────
router.post('/:id/rejeitar',
  authenticate,
  authorize(...PERFIS_APROVADORES),
  audit('REJEITAR_MOVIMENTACAO', 'movimentacoes'),
  [
    param('id').matches(UUID_REGEX),
    body('motivo').isString().trim().isLength({ min: 5, max: 1000 }).withMessage('Motivo deve ter 5-1000 caracteres'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { motivo } = req.body;

      const movRes = await query('SELECT status, criado_por FROM movimentacoes WHERE id = $1', [id]);
      if (movRes.rows.length === 0) throw new NotFoundError('Movimentação');
      if (movRes.rows[0].status !== 'PENDENTE') {
        throw new AppError(`Movimentação não está pendente (status: ${movRes.rows[0].status})`, 409, 'STATUS_INVALIDO');
      }

      await query(
        `UPDATE movimentacoes
         SET status = 'REJEITADO',
             rejeitado_por = $1,
             rejeitado_em = NOW(),
             motivo_rejeicao = $2
         WHERE id = $3`,
        [req.user.id, motivo, id]
      );

      const io = req.app.get('io');
      if (io) io.emit('movimentacao:rejeitada', { movimentacao_id: id, motivo });

      res.json({ id, status: 'REJEITADO', motivo });
    } catch (err) { next(err); }
  }
);

module.exports = router;
