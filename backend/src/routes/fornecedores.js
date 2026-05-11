const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { audit } = require('../middleware/audit');
const { query } = require('../config/database');
const { NotFoundError } = require('../utils/errors');

const router = express.Router();

// GET /api/v1/fornecedores
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { ativo } = req.query;
    let where = '';
    const params = [];
    if (ativo !== undefined) {
      where = 'WHERE ativo = $1';
      params.push(ativo === 'true' || ativo === '1');
    }
    const result = await query(
      `SELECT id, nome, cnpj, contato_nome, contato_email, contato_telefone,
              cidade, estado, modal_padrao, prazo_pagamento_dias, avaliacao, ativo
       FROM fornecedores ${where} ORDER BY nome ASC`,
      params
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/v1/fornecedores (Apenas admin)
router.post('/', authenticate, authorize('admin'), audit('CRIAR_FORNECEDOR', 'fornecedores'),
  [
    body('nome').trim().isLength({ min: 2, max: 200 }).withMessage('Nome obrigatório'),
    body('cnpj').optional({ checkFalsy: true }).trim().isLength({ min: 14, max: 18 }),
  ], validate,
  async (req, res, next) => {
    try {
      const { nome, cnpj, contato_nome, contato_email, contato_telefone, cidade, estado, modal_padrao, prazo_pagamento_dias, avaliacao } = req.body;
      const result = await query(
        `INSERT INTO fornecedores (nome, cnpj, contato_nome, contato_email, contato_telefone, cidade, estado, modal_padrao, prazo_pagamento_dias, avaliacao, criado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [nome, cnpj, contato_nome, contato_email, contato_telefone, cidade, estado, modal_padrao, prazo_pagamento_dias, avaliacao, req.user.id]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

// GET /api/v1/fornecedores/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM fornecedores WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND', code: 404 });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// PATCH /api/v1/fornecedores/:id (Apenas admin)
router.patch('/:id', authenticate, authorize('admin'), audit('ATUALIZAR_FORNECEDOR', 'fornecedores'),
  async (req, res, next) => {
    try {
      const allowed = ['nome', 'cnpj', 'contato_nome', 'contato_email', 'contato_telefone', 'cidade', 'estado', 'modal_padrao', 'prazo_pagamento_dias', 'avaliacao', 'ativo'];
      const fields = []; const values = []; let idx = 1;
      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          fields.push(`${key} = $${idx++}`);
          values.push(req.body[key]);
        }
      }
      if (fields.length === 0) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Nenhum campo', code: 400 });
      fields.push(`atualizado_em = NOW()`);
      values.push(req.params.id);
      
      const result = await query(`UPDATE fornecedores SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
      if (result.rows.length === 0) throw new NotFoundError('Fornecedor');
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  }
);

// DELETE /api/v1/fornecedores/:id (Apenas admin)
router.delete('/:id', authenticate, authorize('admin'), audit('DESATIVAR_FORNECEDOR', 'fornecedores'),
  async (req, res, next) => {
    try {
      const result = await query('UPDATE fornecedores SET ativo = false, atualizado_em = NOW() WHERE id = $1 RETURNING id', [req.params.id]);
      if (result.rows.length === 0) throw new NotFoundError('Fornecedor');
      res.json({ message: 'Fornecedor desativado' });
    } catch (err) { next(err); }
  }
);

module.exports = router;
