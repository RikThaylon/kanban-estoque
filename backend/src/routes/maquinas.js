const express = require('express');
const { body, param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { audit } = require('../middleware/audit');
const { validate } = require('../middleware/validate');
const { query, getClient } = require('../config/database');
const { NotFoundError } = require('../utils/errors');

const router = express.Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PERFIS_ADMIN = ['admin', 'plant_manager'];
const PERFIS_VINCULAR = ['admin', 'plant_manager', 'gerente_operacoes', 'supervisor_turno'];

/** Lista máquinas (com departamento e contagem de produtos) */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { departamento_id } = req.query;
    const params = []; let where = 'WHERE m.ativo = true';
    if (departamento_id) { params.push(departamento_id); where += ` AND m.departamento_id = $${params.length}`; }
    const result = await query(`
      SELECT m.*, d.nome AS departamento_nome, d.codigo AS departamento_codigo,
        (SELECT COUNT(*) FROM maquina_produto mp WHERE mp.maquina_id = m.id) AS total_produtos
      FROM maquinas m
      LEFT JOIN departamentos d ON d.id = m.departamento_id
      ${where} ORDER BY m.nome ASC
    `, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

/** Detalhe de máquina + produtos vinculados */
router.get('/:id', authenticate, [param('id').matches(UUID)], validate, async (req, res, next) => {
  try {
    const m = await query(`
      SELECT m.*, d.nome AS departamento_nome, d.codigo AS departamento_codigo
      FROM maquinas m LEFT JOIN departamentos d ON d.id = m.departamento_id
      WHERE m.id = $1
    `, [req.params.id]);
    if (m.rows.length === 0) throw new NotFoundError('Máquina');

    const produtos = await query(`
      SELECT p.id, p.codigo, p.nome, p.unidade, p.estoque_atual,
        mp.consumo_estimado_diario, mp.observacao
      FROM maquina_produto mp
      JOIN produtos p ON p.id = mp.produto_id
      WHERE mp.maquina_id = $1
      ORDER BY p.codigo
    `, [req.params.id]);

    res.json({ ...m.rows[0], produtos: produtos.rows });
  } catch (err) { next(err); }
});

router.post('/',
  authenticate, authorize(...PERFIS_ADMIN),
  audit('CRIAR_MAQUINA', 'maquinas'),
  [
    body('codigo').isString().trim().isLength({ min: 2, max: 30 }),
    body('nome').isString().trim().isLength({ min: 2, max: 120 }),
    body('descricao').optional().isString().trim().isLength({ max: 1000 }),
    body('departamento_id').optional({ nullable: true }).custom(v => !v || UUID.test(v)),
    body('localizacao').optional().isString().trim().isLength({ max: 100 }),
  ], validate,
  async (req, res, next) => {
    try {
      const { codigo, nome, descricao, departamento_id, localizacao } = req.body;
      const r = await query(
        `INSERT INTO maquinas (codigo, nome, descricao, departamento_id, localizacao)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [codigo.toUpperCase(), nome, descricao, departamento_id || null, localizacao]
      );
      res.status(201).json(r.rows[0]);
    } catch (err) { next(err); }
  }
);

router.patch('/:id',
  authenticate, authorize(...PERFIS_ADMIN),
  audit('EDITAR_MAQUINA', 'maquinas'),
  [param('id').matches(UUID)], validate,
  async (req, res, next) => {
    try {
      const fields = ['nome', 'descricao', 'departamento_id', 'localizacao', 'ativo'];
      const sets = []; const params = [];
      fields.forEach(f => {
        if (req.body[f] !== undefined) {
          params.push(req.body[f] === '' ? null : req.body[f]);
          sets.push(`${f} = $${params.length}`);
        }
      });
      if (sets.length === 0) return res.status(400).json({ error: 'NO_CHANGES' });
      params.push(req.params.id);
      const r = await query(
        `UPDATE maquinas SET ${sets.join(', ')}, atualizado_em = NOW() WHERE id = $${params.length} RETURNING *`,
        params
      );
      if (r.rows.length === 0) throw new NotFoundError('Máquina');
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  }
);

router.delete('/:id',
  authenticate, authorize(...PERFIS_ADMIN),
  audit('DESATIVAR_MAQUINA', 'maquinas'),
  [param('id').matches(UUID)], validate,
  async (req, res, next) => {
    try {
      const r = await query(
        `UPDATE maquinas SET ativo = false, atualizado_em = NOW() WHERE id = $1 RETURNING id`,
        [req.params.id]
      );
      if (r.rows.length === 0) throw new NotFoundError('Máquina');
      res.json({ message: 'Máquina desativada' });
    } catch (err) { next(err); }
  }
);

// ─── Vínculos máquina ↔ produto ─────────────────────────────

/** POST /api/v1/maquinas/:id/produtos — vincular produto à máquina */
router.post('/:id/produtos',
  authenticate, authorize(...PERFIS_VINCULAR),
  audit('VINCULAR_PRODUTO_MAQUINA', 'maquina_produto'),
  [
    param('id').matches(UUID),
    body('produto_id').matches(UUID),
    body('consumo_estimado_diario').optional().isFloat({ min: 0 }),
    body('observacao').optional().isString().trim().isLength({ max: 500 }),
  ], validate,
  async (req, res, next) => {
    try {
      const { produto_id, consumo_estimado_diario, observacao } = req.body;
      const r = await query(
        `INSERT INTO maquina_produto (maquina_id, produto_id, consumo_estimado_diario, observacao)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (maquina_id, produto_id) DO UPDATE SET
           consumo_estimado_diario = EXCLUDED.consumo_estimado_diario,
           observacao = EXCLUDED.observacao
         RETURNING *`,
        [req.params.id, produto_id, consumo_estimado_diario || 0, observacao]
      );
      res.status(201).json(r.rows[0]);
    } catch (err) { next(err); }
  }
);

/** DELETE /api/v1/maquinas/:id/produtos/:produto_id — desvincular */
router.delete('/:id/produtos/:produto_id',
  authenticate, authorize(...PERFIS_VINCULAR),
  audit('DESVINCULAR_PRODUTO_MAQUINA', 'maquina_produto'),
  [param('id').matches(UUID), param('produto_id').matches(UUID)], validate,
  async (req, res, next) => {
    try {
      const r = await query(
        'DELETE FROM maquina_produto WHERE maquina_id = $1 AND produto_id = $2 RETURNING *',
        [req.params.id, req.params.produto_id]
      );
      if (r.rows.length === 0) throw new NotFoundError('Vínculo');
      res.json({ message: 'Vínculo removido' });
    } catch (err) { next(err); }
  }
);

module.exports = router;
