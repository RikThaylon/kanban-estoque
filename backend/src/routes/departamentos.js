const express = require('express');
const { body, param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { audit } = require('../middleware/audit');
const { validate } = require('../middleware/validate');
const { query } = require('../config/database');
const { NotFoundError } = require('../utils/errors');
const {
  UUID_REGEX,
  PERFIS_GESTAO_DEPARTAMENTO,
  PERFIS_EXCLUIR_DEPARTAMENTO,
  CAMPOS_ATUALIZAVEIS_DEPARTAMENTO,
  normalizarCodigoOperacional,
  montarAtualizacaoOperacional,
} = require('../services/operacional.workflow');

const router = express.Router();

/** Lista todos os departamentos com supervisor, contagem de máquinas */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await query(`
      SELECT d.*, u.nome AS supervisor_nome, u.username AS supervisor_username,
        (SELECT COUNT(*) FROM maquinas m WHERE m.departamento_id = d.id AND m.ativo = true) AS total_maquinas
      FROM departamentos d
      LEFT JOIN usuarios u ON u.id = d.supervisor_id
      WHERE d.ativo = true
      ORDER BY d.nome ASC
    `);
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.get('/:id', authenticate, [param('id').matches(UUID_REGEX)], validate, async (req, res, next) => {
  try {
    const result = await query(`
      SELECT d.*, u.nome AS supervisor_nome, u.username AS supervisor_username
      FROM departamentos d
      LEFT JOIN usuarios u ON u.id = d.supervisor_id
      WHERE d.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) throw new NotFoundError('Departamento');
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.post('/',
  authenticate, authorize(...PERFIS_GESTAO_DEPARTAMENTO),
  audit('CRIAR_DEPARTAMENTO', 'departamentos'),
  [
    body('codigo').isString().trim().isLength({ min: 2, max: 30 }),
    body('nome').isString().trim().isLength({ min: 2, max: 120 }),
    body('descricao').optional().isString().trim().isLength({ max: 1000 }),
    body('supervisor_id').optional({ nullable: true }).matches(UUID_REGEX),
  ], validate,
  async (req, res, next) => {
    try {
      const { codigo, nome, descricao, supervisor_id } = req.body;
      const r = await query(
        `INSERT INTO departamentos (codigo, nome, descricao, supervisor_id)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [normalizarCodigoOperacional(codigo), nome, descricao, supervisor_id || null]
      );
      res.status(201).json(r.rows[0]);
    } catch (err) { next(err); }
  }
);

router.patch('/:id',
  authenticate, authorize(...PERFIS_GESTAO_DEPARTAMENTO),
  audit('EDITAR_DEPARTAMENTO', 'departamentos'),
  [
    param('id').matches(UUID_REGEX),
    body('nome').optional().isString().trim().isLength({ min: 2, max: 120 }),
    body('descricao').optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
    body('supervisor_id').optional({ nullable: true }).custom(v => !v || UUID_REGEX.test(v)),
    body('ativo').optional().isBoolean(),
  ], validate,
  async (req, res, next) => {
    try {
      const { sets, params } = montarAtualizacaoOperacional(req.body, CAMPOS_ATUALIZAVEIS_DEPARTAMENTO);
      if (sets.length === 0) return res.status(400).json({ error: 'NO_CHANGES' });
      params.push(req.params.id);
      const r = await query(
        `UPDATE departamentos SET ${sets.join(', ')}, atualizado_em = NOW() WHERE id = $${params.length} RETURNING *`,
        params
      );
      if (r.rows.length === 0) throw new NotFoundError('Departamento');
      res.json(r.rows[0]);
    } catch (err) { next(err); }
  }
);

router.delete('/:id',
  authenticate, authorize(...PERFIS_EXCLUIR_DEPARTAMENTO),
  audit('DESATIVAR_DEPARTAMENTO', 'departamentos'),
  [param('id').matches(UUID_REGEX)], validate,
  async (req, res, next) => {
    try {
      const r = await query(
        `UPDATE departamentos SET ativo = false, atualizado_em = NOW() WHERE id = $1 RETURNING id`,
        [req.params.id]
      );
      if (r.rows.length === 0) throw new NotFoundError('Departamento');
      res.json({ message: 'Departamento desativado' });
    } catch (err) { next(err); }
  }
);

module.exports = router;
