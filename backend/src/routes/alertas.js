const express = require('express');
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

const router = express.Router();

// GET /api/v1/alertas
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { limit, offset, page } = parsePagination(req.query);
    const countRes = await query('SELECT COUNT(*) FROM alertas WHERE lido = false');
    const total = parseInt(countRes.rows[0].count);
    const result = await query(
      `SELECT a.*, p.nome AS produto_nome, p.codigo AS produto_codigo
       FROM alertas a LEFT JOIN produtos p ON p.id = a.produto_id
       WHERE a.lido = false ORDER BY a.criado_em DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(paginatedResponse(result.rows, total, page, limit));
  } catch (err) { next(err); }
});

// PATCH /api/v1/alertas/:id/ler
router.patch('/:id/ler', authenticate, async (req, res, next) => {
  try {
    await query('UPDATE alertas SET lido = true, lido_por = $1, lido_em = NOW() WHERE id = $2', [req.user.id, req.params.id]);
    res.json({ message: 'Alerta marcado como lido' });
  } catch (err) { next(err); }
});

// POST /api/v1/alertas/ler-todos
router.post('/ler-todos', authenticate, async (req, res, next) => {
  try {
    await query('UPDATE alertas SET lido = true, lido_por = $1, lido_em = NOW() WHERE lido = false', [req.user.id]);
    res.json({ message: 'Todos alertas marcados como lidos' });
  } catch (err) { next(err); }
});

module.exports = router;
