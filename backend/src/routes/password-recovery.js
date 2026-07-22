/**
 * @module password-recovery
 * @description Fluxo corporativo de recuperação de senha sem e-mail externo.
 *
 * Fluxo:
 * 1. Usuário solicita recuperação (POST /forgot-password)
 * 2. Sistema cria chamado interno (status: PENDENTE)
 * 3. Admin visualiza solicitações (GET /password-reset-requests)
 * 4. Admin aprova → sistema gera token temporário (POST /:id/approve)
 * 5. Usuário recebe token (exibido para admin copiar/compartilhar internamente)
 * 6. Usuário redefine senha com token (POST /reset-password)
 * 7. Token expira em 2h — todas as sessões encerradas
 *
 * Segurança:
 * - Rate limit: 3 solicitações por hora por usuário
 * - Token: UUID v4 com hash SHA-256 armazenado
 * - Expira em 2h após aprovação
 * - Não reutilização das últimas 5 senhas
 * - Sessões encerradas após redefinição
 * - Logs completos de auditoria
 */

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { audit } = require('../middleware/audit');
const rateLimit = require('express-rate-limit');
const { query } = require('../config/database');
const { AppError, NotFoundError, AuthError } = require('../utils/errors');
const logger = require('../utils/logger');

const router = express.Router();

// Rate limiter específico para recuperação de senha (3/hora por IP)
const recoveryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'RATE_LIMIT', message: 'Muitas solicitações de recuperação. Tente novamente em 1 hora.', code: 429 },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
});

/**
 * Política de senha forte:
 * - Mínimo 8 caracteres
 * - Pelo menos 1 maiúscula
 * - Pelo menos 1 número
 * - Pelo menos 1 caractere especial
 */
function validarPoliticaSenha(senha) {
  if (senha.length < 8) return 'Senha deve ter pelo menos 8 caracteres';
  if (!/[A-Z]/.test(senha)) return 'Senha deve conter pelo menos uma letra maiúscula';
  if (!/[0-9]/.test(senha)) return 'Senha deve conter pelo menos um número';
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(senha)) return 'Senha deve conter pelo menos um caractere especial';
  return null;
}

/**
 * Gerar token seguro + hash para armazenar
 */
function gerarTokenRecuperacao() {
  const token = crypto.randomUUID() + '-' + crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

// ─── POST /api/v1/auth/forgot-password ───────────────────────────────────────
router.post('/forgot-password', recoveryLimiter,
  [
    body('username').trim().isLength({ min: 1, max: 60 }).withMessage('Username obrigatório'),
    body('motivo').optional().trim().isLength({ max: 500 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { username, motivo } = req.body;

      // Buscar usuário (mensagem genérica para evitar enumeração)
      const userResult = await query(
        'SELECT id, nome FROM usuarios WHERE username = $1 AND ativo = true',
        [username]
      );

      // Resposta sempre igual para evitar enumeração de usuários
      const msgPadrao = { message: 'Se o usuário existir, sua solicitação foi registrada e está aguardando aprovação do administrador.' };

      if (userResult.rows.length === 0) {
        logger.warn('forgot_password: usuário não encontrado', { username, ip: req.ip });
        return res.json(msgPadrao);
      }

      const user = userResult.rows[0];

      // Verificar se já há solicitação pendente (não criar duplicata)
      const pendente = await query(
        "SELECT id FROM password_reset_requests WHERE usuario_id = $1 AND status = 'PENDENTE'",
        [user.id]
      );

      if (pendente.rows.length > 0) {
        logger.warn('forgot_password: solicitação pendente já existe', { userId: user.id, ip: req.ip });
        return res.json(msgPadrao);
      }

      // Criar solicitação
      await query(`
        INSERT INTO password_reset_requests (usuario_id, ip_solicitante)
        VALUES ($1, $2)
      `, [user.id, req.ip]);

      logger.info('forgot_password: solicitação criada', { userId: user.id, ip: req.ip });

      res.json(msgPadrao);
    } catch (err) { next(err); }
  }
);

// ─── GET /api/v1/auth/password-reset-requests (admin only) ───────────────────
router.get('/password-reset-requests', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { status } = req.query;

    const params = [];
    let where = 'WHERE 1=1';
    if (status) { params.push(status); where += ` AND prr.status = $${params.length}`; }

    const result = await query(`
      SELECT prr.*, u.nome AS usuario_nome, u.username, u.email,
             a.nome AS aprovado_por_nome
      FROM password_reset_requests prr
      JOIN usuarios u ON u.id = prr.usuario_id
      LEFT JOIN usuarios a ON a.id = prr.aprovado_por
      ${where}
      ORDER BY prr.criado_em DESC
    `, params);

    res.json(result.rows);
  } catch (err) { next(err); }
});

// ─── POST /api/v1/auth/password-reset-requests/:id/approve (admin only) ──────
router.post('/password-reset-requests/:id/approve',
  authenticate, authorize('admin'),
  audit('APROVAR_RECUPERACAO_SENHA', 'password_reset_requests'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      // Buscar solicitação
      const reqResult = await query(
        "SELECT * FROM password_reset_requests WHERE id = $1 AND status = 'PENDENTE'",
        [id]
      );
      if (reqResult.rows.length === 0) {
        throw new NotFoundError('Solicitação de recuperação não encontrada ou já processada');
      }

      // Gerar token temporário
      const { token, hash } = gerarTokenRecuperacao();
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2h

      await query(`
        UPDATE password_reset_requests
        SET status = 'APROVADO', token_hash = $1, expira_em = $2,
            aprovado_por = $3, aprovado_em = NOW(), atualizado_em = NOW()
        WHERE id = $4
      `, [hash, expiresAt, req.user.id, id]);

      logger.info('password_reset_approved', {
        requestId: id,
        approvedBy: req.user.id,
        expiresAt,
      });

      // IMPORTANTE: Retornar token para admin copiar e entregar ao usuário
      // (por canal seguro interno — ex: presencialmente ou sistema de mensagens interno)
      res.json({
        message: 'Solicitação aprovada. Compartilhe o token abaixo com o usuário por canal seguro.',
        token, // Token em texto plano — apenas neste momento
        expira_em: expiresAt,
        aviso: 'Este token não será exibido novamente. Guarde-o com segurança e compartilhe com o usuário.',
      });
    } catch (err) { next(err); }
  }
);

// ─── POST /api/v1/auth/password-reset-requests/:id/reject (admin only) ───────
router.post('/password-reset-requests/:id/reject',
  authenticate, authorize('admin'),
  audit('REJEITAR_RECUPERACAO_SENHA', 'password_reset_requests'),
  [body('motivo_rejeicao').optional().trim().isLength({ max: 500 })],
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { motivo_rejeicao } = req.body;

      const result = await query(`
        UPDATE password_reset_requests
        SET status = 'REJEITADO', motivo_rejeicao = $1,
            aprovado_por = $2, aprovado_em = NOW(), atualizado_em = NOW()
        WHERE id = $3 AND status = 'PENDENTE'
        RETURNING id
      `, [motivo_rejeicao || null, req.user.id, id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Solicitação não encontrada ou já processada');
      }

      logger.info('password_reset_rejected', { requestId: id, rejectedBy: req.user.id });
      res.json({ message: 'Solicitação rejeitada' });
    } catch (err) { next(err); }
  }
);

// ─── POST /api/v1/auth/reset-password ────────────────────────────────────────
router.post('/reset-password', recoveryLimiter,
  [
    body('token').trim().isLength({ min: 1 }).withMessage('Token obrigatório'),
    body('nova_senha').isLength({ min: 8, max: 100 }).withMessage('Nova senha deve ter entre 8 e 100 caracteres'),
    body('confirmar_senha').custom((value, { req }) => {
      if (value !== req.body.nova_senha) throw new Error('Senhas não conferem');
      return true;
    }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { token, nova_senha } = req.body;

      // Validar política de senha
      const erroSenha = validarPoliticaSenha(nova_senha);
      if (erroSenha) throw new AppError(erroSenha, 400, 'VALIDATION_ERROR');

      // Hash do token fornecido
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      // Buscar solicitação válida
      const reqResult = await query(`
        SELECT prr.*, u.id AS usuario_id, u.senha_hash AS senha_atual
        FROM password_reset_requests prr
        JOIN usuarios u ON u.id = prr.usuario_id
        WHERE prr.token_hash = $1
          AND prr.status = 'APROVADO'
          AND prr.expira_em > NOW()
      `, [tokenHash]);

      if (reqResult.rows.length === 0) {
        throw new AuthError('Token inválido, expirado ou já utilizado');
      }

      const req_ = reqResult.rows[0];

      // Verificar histórico de senhas (não reutilizar últimas 5)
      const historico = await query(
        'SELECT senha_hash FROM password_history WHERE usuario_id = $1 ORDER BY criado_em DESC LIMIT 5',
        [req_.usuario_id]
      );

      for (const hist of historico.rows) {
        const reutilizando = await bcrypt.compare(nova_senha, hist.senha_hash);
        if (reutilizando) {
          throw new AppError('Não é permitido reutilizar uma das últimas 5 senhas', 400, 'VALIDATION_ERROR');
        }
      }

      // Hash da nova senha
      const novaSenhaHash = await bcrypt.hash(nova_senha, 12);

      // Atualizar senha e registrar no histórico
      await Promise.all([
        query(
          'UPDATE usuarios SET senha_hash = $1, tentativas_login = 0, bloqueado_ate = NULL, atualizado_em = NOW() WHERE id = $2',
          [novaSenhaHash, req_.usuario_id]
        ),
        query(
          'INSERT INTO password_history (usuario_id, senha_hash) VALUES ($1, $2)',
          [req_.usuario_id, novaSenhaHash]
        ),
        // Marcar solicitação como usada
        query(
          "UPDATE password_reset_requests SET status = 'USADO', usado_em = NOW(), ip_redefinicao = $1, atualizado_em = NOW() WHERE id = $2",
          [req.ip, req_.id]
        ),
        // Encerrar TODAS as sessões ativas do usuário (segurança)
        query(
          "UPDATE refresh_tokens SET revogado = true WHERE usuario_id = $1 AND revogado = false",
          [req_.usuario_id]
        ),
      ]);

      logger.info('password_reset_success', { userId: req_.usuario_id, ip: req.ip });

      // Manter apenas as últimas 5 senhas no histórico
      await query(`
        DELETE FROM password_history
        WHERE usuario_id = $1
          AND id NOT IN (
            SELECT id FROM password_history
            WHERE usuario_id = $1
            ORDER BY criado_em DESC
            LIMIT 5
          )
      `, [req_.usuario_id]);

      res.json({
        message: 'Senha redefinida com sucesso. Todas as sessões foram encerradas. Faça login novamente.',
      });
    } catch (err) { next(err); }
  }
);

module.exports = router;
