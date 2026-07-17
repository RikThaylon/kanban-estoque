const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { audit } = require('../middleware/audit');
const { query } = require('../config/database');
const { NotFoundError, AppError } = require('../utils/errors');

const router = express.Router();

// ─── GET /api/v1/categorias ──────────────────────────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await query(`
      SELECT c.id, c.nome, c.descricao, c.cor_hex,
             COUNT(p.id) AS total_produtos
      FROM categorias c
      LEFT JOIN produtos p ON p.categoria_id = c.id AND p.ativo = true
      GROUP BY c.id, c.nome, c.descricao, c.cor_hex
      ORDER BY c.nome ASC
    `);
    res.json(result.rows.map(r => ({
      ...r,
      total_produtos: parseInt(r.total_produtos, 10),
    })));
  } catch (err) { next(err); }
});

// ─── POST /api/v1/categorias (admin only) ─────────────────────────────────────
router.post('/', authenticate, authorize('admin'),
  audit('CRIAR_CATEGORIA', 'categorias'),
  [
    body('nome').trim().isLength({ min: 2, max: 100 }).withMessage('Nome obrigatório (2-100 chars)'),
    body('descricao').optional().trim().isLength({ max: 500 }),
    body('cor_hex').optional().trim().matches(/^[0-9A-Fa-f]{6}$/).withMessage('cor_hex deve ser hexadecimal de 6 caracteres'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { nome, descricao, cor_hex } = req.body;

      // Verificar duplicidade
      const exists = await query('SELECT id FROM categorias WHERE LOWER(nome) = LOWER($1)', [nome]);
      if (exists.rows.length > 0) {
        throw new AppError('Categoria com este nome já existe', 409, 'CONFLICT');
      }

      const result = await query(
        'INSERT INTO categorias (nome, descricao, cor_hex) VALUES ($1, $2, $3) RETURNING *',
        [nome, descricao || null, cor_hex || 'CBD5E1']
      );
      res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

// ─── PATCH /api/v1/categorias/:id (admin only) ────────────────────────────────
router.patch('/:id', authenticate, authorize('admin'),
  audit('ATUALIZAR_CATEGORIA', 'categorias'),
  [
    body('nome').optional().trim().isLength({ min: 2, max: 100 }),
    body('descricao').optional().trim().isLength({ max: 500 }),
    body('cor_hex').optional().trim().matches(/^[0-9A-Fa-f]{6}$/).withMessage('cor_hex deve ser hexadecimal de 6 caracteres'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { nome, descricao, cor_hex } = req.body;
      const { id } = req.params;

      const fields = [];
      const values = [];
      let idx = 1;

      if (nome !== undefined) { fields.push(`nome = $${idx++}`); values.push(nome); }
      if (descricao !== undefined) { fields.push(`descricao = $${idx++}`); values.push(descricao); }
      if (cor_hex !== undefined) { fields.push(`cor_hex = $${idx++}`); values.push(cor_hex); }

      if (fields.length === 0) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Nenhum campo para atualizar' });
      }

      values.push(id);
      const result = await query(
        `UPDATE categorias SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );
      if (result.rows.length === 0) throw new NotFoundError('Categoria');
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

// ─── DELETE /api/v1/categorias/:id (admin only) ───────────────────────────────
// Nota: soft delete via reassignment — produtos migram para "Outros"
router.delete('/:id', authenticate, authorize('admin'),
  audit('EXCLUIR_CATEGORIA', 'categorias'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      // Categorias padrão não podem ser excluídas
      const padrao = '00000000-0000-0000-0001-000000000012'; // "Outros"
      if (id === padrao) {
        throw new AppError('A categoria "Outros" não pode ser excluída', 400, 'VALIDATION_ERROR');
      }

      // Migrar produtos para "Outros"
      await query(
        `UPDATE produtos SET categoria_id = $1 WHERE categoria_id = $2`,
        [padrao, id]
      );

      const result = await query('DELETE FROM categorias WHERE id = $1 RETURNING id', [id]);
      if (result.rows.length === 0) throw new NotFoundError('Categoria');

      res.json({ message: 'Categoria excluída. Produtos migrados para "Outros".' });
    } catch (err) { next(err); }
  }
);

module.exports = router;
