const express = require('express');
const { body } = require('express-validator');
const bcrypt = require('bcrypt');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize, PERFIS_VALIDOS } = require('../middleware/rbac');
const { audit } = require('../middleware/audit');
const { query } = require('../config/database');
const { env } = require('../config/env');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { NotFoundError } = require('../utils/errors');

const router = express.Router();
const SENHA_MIN = 8;
const SENHA_MAX = 100;
const SENHA_REGEX = /^\S+$/;

const validarSenha = (campo) => body(campo)
  .isString().withMessage('Senha obrigatoria')
  .isLength({ min: SENHA_MIN, max: SENHA_MAX }).withMessage(`Senha precisa ter entre ${SENHA_MIN} e ${SENHA_MAX} caracteres`)
  .matches(SENHA_REGEX).withMessage('Senha nao pode conter espacos');

// Lista usuarios — admin e visualizadores podem listar; demais nao
router.get('/', authenticate, authorize('admin', 'plant_manager', 'gerente_engenharia', 'eng_processos', 'eng_producao', 'gerente_operacoes', 'visualizador'),
  async (req, res, next) => {
    try {
      const { limit, offset, page } = parsePagination(req.query);
      const countRes = await query('SELECT COUNT(*) FROM usuarios');
      const total = parseInt(countRes.rows[0].count, 10);
      const result = await query(
        `SELECT id, nome, username, perfil, ativo, ultimo_login, criado_em
         FROM usuarios ORDER BY nome LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      res.json(paginatedResponse(result.rows, total, page, limit));
    } catch (err) { next(err); }
  }
);

// Lista cargos disponíveis (ajuda no frontend para preencher selects)
router.get('/cargos', authenticate, async (req, res) => {
  res.json({ cargos: PERFIS_VALIDOS });
});

// Criar usuario (somente admin)
router.post('/', authenticate, authorize('admin'), audit('CRIAR_USUARIO', 'usuarios'),
  [
    body('nome').trim().isLength({ min: 1, max: 120 }).withMessage('Nome obrigatório'),
    body('username').trim().isLength({ min: 3, max: 60 }).matches(/^[a-zA-Z0-9._-]+$/)
      .withMessage('Username só pode conter letras, números, ponto, hífen e underline'),
    validarSenha('senha'),
    body('perfil').isIn(PERFIS_VALIDOS).withMessage('Perfil inválido'),
  ], validate,
  async (req, res, next) => {
    try {
      const { nome, username, senha, perfil } = req.body;
      const senhaHash = await bcrypt.hash(senha, env.BCRYPT_ROUNDS);
      const result = await query(
        `INSERT INTO usuarios (nome, username, senha_hash, perfil)
         VALUES ($1, $2, $3, $4)
         RETURNING id, nome, username, perfil, ativo, criado_em`,
        [nome, username, senhaHash, perfil]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'CONFLICT', message: 'Usuário já existe', code: 409 });
      }
      next(err);
    }
  }
);

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, nome, username, perfil, ativo, ultimo_login, criado_em FROM usuarios WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) throw new NotFoundError('Usuário');
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// Atualizar usuario — admin pode tudo; usuario pode atualizar so o proprio nome
router.patch('/:id', authenticate, audit('ATUALIZAR_USUARIO', 'usuarios'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const isAdmin = req.user.perfil === 'admin';
      const isSelf = req.user.id === id;
      if (!isAdmin && !isSelf) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Sem permissão', code: 403 });
      }

      // Campos permitidos para o proprio usuario (sem alterar perfil/ativo)
      const camposProprios = ['nome'];
      const camposAdmin = ['nome', 'username', 'perfil', 'ativo'];
      const allowed = isAdmin ? camposAdmin : camposProprios;

      // Valida perfil se for admin alterando
      if (isAdmin && req.body.perfil !== undefined && !PERFIS_VALIDOS.includes(req.body.perfil)) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Perfil inválido', code: 400 });
      }

      const fields = []; const values = []; let idx = 1;
      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          fields.push(`${key} = $${idx++}`);
          values.push(req.body[key]);
        }
      }
      if (fields.length === 0) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Nada para atualizar', code: 400 });
      }
      fields.push('atualizado_em = NOW()');
      values.push(id);
      const result = await query(
        `UPDATE usuarios SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, nome, username, perfil, ativo`,
        values
      );
      if (result.rows.length === 0) throw new NotFoundError('Usuário');
      res.json(result.rows[0]);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'CONFLICT', message: 'Username já existe', code: 409 });
      }
      next(err);
    }
  }
);

// Soft delete (somente admin)
router.delete('/:id', authenticate, authorize('admin'), audit('DESATIVAR_USUARIO', 'usuarios'),
  async (req, res, next) => {
    try {
      if (req.user.id === req.params.id) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Você não pode desativar seu próprio usuário', code: 400 });
      }
      await query('UPDATE usuarios SET ativo = false, atualizado_em = NOW() WHERE id = $1', [req.params.id]);
      res.json({ message: 'Usuário desativado' });
    } catch (err) { next(err); }
  }
);

// Reset de senha (somente admin)
router.post('/:id/reset-senha', authenticate, authorize('admin'), audit('RESET_SENHA', 'usuarios'),
  [validarSenha('nova_senha')], validate,
  async (req, res, next) => {
    try {
      const senhaHash = await bcrypt.hash(req.body.nova_senha, env.BCRYPT_ROUNDS);
      await query(
        'UPDATE usuarios SET senha_hash = $1, tentativas_login = 0, bloqueado_ate = NULL, atualizado_em = NOW() WHERE id = $2',
        [senhaHash, req.params.id]
      );
      res.json({ message: 'Senha redefinida com sucesso' });
    } catch (err) { next(err); }
  }
);

module.exports = router;
