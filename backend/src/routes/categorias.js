const express = require('express');
const { body, param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { audit } = require('../middleware/audit');
const { validate } = require('../middleware/validate');
const { pool } = require('../config/database');

const router = express.Router();

// GET /api/v1/categorias
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM categorias ORDER BY nome ASC');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/categorias
router.post('/',
  authenticate,
  authorize('admin'),
  audit('CRIAR_CATEGORIA', 'categorias'),
  [
    body('nome').trim().isLength({ min: 1, max: 100 }).withMessage('O nome deve ter entre 1 e 100 caracteres'),
    body('descricao').optional({ checkFalsy: true }).trim(),
    body('cor_hex').optional({ checkFalsy: true }).trim().matches(/^[0-9A-Fa-f]{6}$/).withMessage('Cor deve ser um hexadecimal de 6 caracteres (sem #)'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { nome, descricao, cor_hex } = req.body;
      const finalCor = cor_hex || 'CBD5E1';
      
      const { rows } = await pool.query(
        `INSERT INTO categorias (nome, descricao, cor_hex) VALUES ($1, $2, $3) RETURNING *`,
        [nome, descricao, finalCor]
      );
      
      res.status(201).json(rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/v1/categorias/:id
router.put('/:id',
  authenticate,
  authorize('admin'),
  audit('ATUALIZAR_CATEGORIA', 'categorias'),
  [
    param('id').isUUID().withMessage('ID inválido'),
    body('nome').trim().isLength({ min: 1, max: 100 }).withMessage('O nome deve ter entre 1 e 100 caracteres'),
    body('descricao').optional({ checkFalsy: true }).trim(),
    body('cor_hex').optional({ checkFalsy: true }).trim().matches(/^[0-9A-Fa-f]{6}$/).withMessage('Cor deve ser um hexadecimal de 6 caracteres (sem #)'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { nome, descricao, cor_hex } = req.body;
      const finalCor = cor_hex || 'CBD5E1';
      
      const { rowCount, rows } = await pool.query(
        `UPDATE categorias SET nome = $1, descricao = $2, cor_hex = $3 WHERE id = $4 RETURNING *`,
        [nome, descricao, finalCor, id]
      );
      
      if (rowCount === 0) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Categoria não encontrada' });
      }
      
      res.json(rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/categorias/:id
router.delete('/:id',
  authenticate,
  authorize('admin'),
  audit('EXCLUIR_CATEGORIA', 'categorias'),
  [
    param('id').isUUID().withMessage('ID inválido'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      
      // Verifica se existem produtos atrelados
      const prodCheck = await pool.query('SELECT id FROM produtos WHERE categoria_id = $1 LIMIT 1', [id]);
      if (prodCheck.rowCount > 0) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Não é possível excluir uma categoria que possui produtos vinculados' });
      }
      
      const { rowCount } = await pool.query('DELETE FROM categorias WHERE id = $1', [id]);
      
      if (rowCount === 0) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Categoria não encontrada' });
      }
      
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
