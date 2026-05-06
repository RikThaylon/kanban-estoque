const express = require('express');
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');

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

// GET /api/v1/fornecedores/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM fornecedores WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND', code: 404 });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
