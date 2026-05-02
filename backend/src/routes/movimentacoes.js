const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { audit } = require('../middleware/audit');
const { createLimiter } = require('../middleware/rateLimiter');
const { query, getClient } = require('../config/database');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { AppError, NotFoundError } = require('../utils/errors');
const { recalcularKanban } = require('../services/kanban.calc');

const router = express.Router();

// GET /api/v1/movimentacoes
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { limit, offset, page } = parsePagination(req.query);
    const { produto_id, tipo, data_inicio, data_fim } = req.query;
    let where = []; const params = []; let idx = 1;

    if (produto_id) { where.push(`m.produto_id = $${idx++}`); params.push(produto_id); }
    if (tipo) { where.push(`m.tipo = $${idx++}`); params.push(tipo); }
    if (data_inicio) { where.push(`m.criado_em >= $${idx++}`); params.push(data_inicio); }
    if (data_fim) { where.push(`m.criado_em <= $${idx++}`); params.push(data_fim); }

    const whereStr = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const countRes = await query(`SELECT COUNT(*) FROM movimentacoes m ${whereStr}`, params);
    const total = parseInt(countRes.rows[0].count);

    const dataRes = await query(
      `SELECT m.*, p.nome AS produto_nome, p.codigo AS produto_codigo, u.nome AS criado_por_nome
       FROM movimentacoes m
       LEFT JOIN produtos p ON p.id = m.produto_id
       LEFT JOIN usuarios u ON u.id = m.criado_por
       ${whereStr}
       ORDER BY m.criado_em DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    );

    res.json(paginatedResponse(dataRes.rows, total, page, limit));
  } catch (err) { next(err); }
});

// POST /api/v1/movimentacoes
router.post('/', authenticate, authorize('admin', 'gerente_operacoes', 'supervisor_turno', 'facilitador', 'comprador'), createLimiter, audit('CRIAR_MOVIMENTACAO', 'movimentacoes'),
  [
    body('produto_id').matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).withMessage('produto_id inválido'),
    body('tipo').isIn(['ENTRADA', 'SAIDA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'TRANSFERENCIA', 'DEVOLUCAO']).withMessage('Tipo inválido'),
    body('quantidade').isFloat({ gt: 0 }).withMessage('Quantidade deve ser > 0'),
    body('referencia').optional().trim().isLength({ max: 100 }),
    body('numero_documento').optional().trim().isLength({ max: 80 }),
    body('observacao').optional().trim().isLength({ max: 1000 }),
  ], validate,
  async (req, res, next) => {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const { produto_id, tipo, quantidade, referencia, numero_documento, observacao } = req.body;

      // Buscar estoque atual com lock
      const prodRes = await client.query('SELECT estoque_atual FROM produtos WHERE id = $1 FOR UPDATE', [produto_id]);
      if (prodRes.rows.length === 0) throw new NotFoundError('Produto');

      const estoqueAntes = parseFloat(prodRes.rows[0].estoque_atual);
      let estoqueDepois;

      switch (tipo) {
        case 'ENTRADA': case 'AJUSTE_POSITIVO': case 'DEVOLUCAO':
          estoqueDepois = estoqueAntes + parseFloat(quantidade);
          break;
        case 'SAIDA': case 'TRANSFERENCIA':
          estoqueDepois = estoqueAntes - parseFloat(quantidade);
          if (estoqueDepois < 0) {
            throw new AppError('Estoque insuficiente para esta operação', 400, 'ESTOQUE_INSUFICIENTE');
          }
          break;
        case 'AJUSTE_NEGATIVO':
          estoqueDepois = estoqueAntes - parseFloat(quantidade);
          break;
        default:
          throw new AppError('Tipo de movimentação inválido', 400, 'TIPO_INVALIDO');
      }

      const movRes = await client.query(
        `INSERT INTO movimentacoes (produto_id, tipo, quantidade, estoque_antes, estoque_depois, referencia, numero_documento, observacao, criado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [produto_id, tipo, quantidade, estoqueAntes, estoqueDepois, referencia, numero_documento, observacao, req.user.id]
      );

      await client.query('COMMIT');

      // Recalcular Kanban (fora da transação)
      const io = req.app.get('io');
      recalcularKanban(produto_id, io).catch(err => {
        const logger = require('../utils/logger');
        logger.error('Erro ao recalcular Kanban após movimentação', { error: err.message });
      });

      // Emitir evento Socket.io
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

module.exports = router;
