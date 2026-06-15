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
const {
  SENHA_MIN,
  SENHA_MAX,
  SENHA_REGEX,
  validarPermissaoEdicaoUsuario,
  montarAtualizacaoUsuario,
  validarDesativacaoUsuario,
  erroUsuarioDuplicado,
} = require('../services/usuario.workflow');

const router = express.Router();

const validarSenha = (campo) => body(campo)
  .isString().withMessage('Senha obrigatoria')
  .isLength({ min: SENHA_MIN, max: SENHA_MAX }).withMessage(`Senha precisa ter entre ${SENHA_MIN} e ${SENHA_MAX} caracteres`)
  .matches(SENHA_REGEX).withMessage('Senha nao pode conter espacos');

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

router.get('/cargos', authenticate, async (req, res) => {
  res.json({ cargos: PERFIS_VALIDOS });
});

router.post('/', authenticate, authorize('admin'), audit('CRIAR_USUARIO', 'usuarios'),
  [
    body('nome').trim().isLength({ min: 1, max: 120 }).withMessage('Nome obrigatorio'),
    body('username').trim().isLength({ min: 3, max: 60 }).matches(/^[a-zA-Z0-9._-]+$/)
      .withMessage('Username so pode conter letras, numeros, ponto, hifen e underline'),
    validarSenha('senha'),
    body('perfil').isIn(PERFIS_VALIDOS).withMessage('Perfil invalido'),
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
      next(erroUsuarioDuplicado(err, 'Usuario ja existe') || err);
    }
  }
);

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, nome, username, perfil, ativo, ultimo_login, criado_em FROM usuarios WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) throw new NotFoundError('Usuario');
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.patch('/:id', authenticate, audit('ATUALIZAR_USUARIO', 'usuarios'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      validarPermissaoEdicaoUsuario(req.user, id);

      const { fields, values, nextIndex: idx } = montarAtualizacaoUsuario(req.body, req.user);
      if (fields.length === 0) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Nada para atualizar', code: 400 });
      }

      fields.push('atualizado_em = NOW()');
      values.push(id);
      const result = await query(
        `UPDATE usuarios SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, nome, username, perfil, ativo`,
        values
      );
      if (result.rows.length === 0) throw new NotFoundError('Usuario');
      res.json(result.rows[0]);
    } catch (err) {
      next(erroUsuarioDuplicado(err, 'Username ja existe') || err);
    }
  }
);

router.delete('/:id', authenticate, authorize('admin'), audit('DESATIVAR_USUARIO', 'usuarios'),
  async (req, res, next) => {
    try {
      validarDesativacaoUsuario(req.user, req.params.id);
      await query('UPDATE usuarios SET ativo = false, atualizado_em = NOW() WHERE id = $1', [req.params.id]);
      res.json({ message: 'Usuario desativado' });
    } catch (err) { next(err); }
  }
);

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
