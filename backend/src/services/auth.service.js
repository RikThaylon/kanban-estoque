const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { env } = require('../config/env');
const { query } = require('../config/database');
const { redis } = require('../config/redis');
const { AuthError, AppError } = require('../utils/errors');
const logger = require('../utils/logger');
const { hashToken, legacyHashToken } = require('../utils/sensitiveData');

// ─── Security constants ───────────────────────────────────────────────────────
const GRACE_PERIOD_MS = 15_000; // 15s tolerance for concurrent refresh (double F5 / Strict Mode)
const JWT_ALGORITHMS = ['HS256']; // Explicit allowlist — prevents alg:none / confusion attacks

class AuthService {
  /**
   * Gera par de tokens (access + refresh) com JTI
   * @param {{ id: number, username: string, perfil: string, nome: string }} user
   * @returns {{ accessToken: string, refreshToken: string, jti: string }}
   */
  generateTokens(user) {
    const jti = crypto.randomUUID();
    const accessToken = jwt.sign(
      { id: user.id, username: user.username, perfil: user.perfil, nome: user.nome },
      env.JWT_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRY, algorithm: 'HS256' }
    );
    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh', jti },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRY, algorithm: 'HS256' }
    );
    return { accessToken, refreshToken, jti };
  }

  /**
   * Login com username e senha
   */
  async login(username, senha, ip, userAgent) {
    const result = await query(
      'SELECT id, nome, username, senha_hash, perfil, ativo, tentativas_login, bloqueado_ate FROM usuarios WHERE username = $1',
      [username]
    );

    const user = result.rows[0];
    if (!user) {
      logger.warn('login_fail: username inexistente', { username, ip, event: 'login_fail' });
      // Generic message — prevent user enumeration (Phase 2.4)
      throw new AuthError('Credenciais inválidas');
    }

    if (!user.ativo) {
      logger.warn('login_fail: usuário desativado', { userId: user.id, ip, event: 'login_fail' });
      throw new AuthError('Credenciais inválidas');
    }

    // Check lockout
    if (user.bloqueado_ate && new Date(user.bloqueado_ate) > new Date()) {
      const minutosRestantes = Math.ceil((new Date(user.bloqueado_ate) - new Date()) / 60000);
      throw new AuthError(`Conta bloqueada. Tente novamente em ${minutosRestantes} minutos.`);
    }

    // Validate hash format before calling bcrypt — prevents crash with undefined/empty hash
    if (!user.senha_hash || typeof user.senha_hash !== 'string' || !/\$2[aby]\$/.test(user.senha_hash)) {
      logger.warn('login_fail: senha_hash inválido', { userId: user.id, ip, event: 'login_fail' });
      throw new AuthError('Credenciais inválidas');
    }

    let senhaValida = false;
    try {
      senhaValida = await bcrypt.compare(senha, user.senha_hash);
    } catch (err) {
      logger.error('Erro interno ao comparar senha (bcrypt)', { err: err.message, userId: user.id, ip });
      throw new AuthError('Erro ao autenticar');
    }

    if (!senhaValida) {
      const tentativas = (user.tentativas_login || 0) + 1;
      if (tentativas >= 5) {
        await query(
          "UPDATE usuarios SET tentativas_login = $1, bloqueado_ate = NOW() + INTERVAL '15 minutes' WHERE id = $2",
          [tentativas, user.id]
        );
        logger.warn('login_fail: conta bloqueada por brute force', { userId: user.id, ip, event: 'login_fail', tentativas });
        throw new AuthError('Conta bloqueada por 15 minutos após 5 tentativas falhas.');
      }
      await query('UPDATE usuarios SET tentativas_login = $1 WHERE id = $2', [tentativas, user.id]);
      // Generic message for wrong password — prevent user enumeration (Phase 2.4)
      throw new AuthError('Credenciais inválidas');
    }

    // Reset attempts and update last login
    await query(
      'UPDATE usuarios SET tentativas_login = 0, bloqueado_ate = NULL, ultimo_login = NOW() WHERE id = $1',
      [user.id]
    );

    const { accessToken, refreshToken, jti } = this.generateTokens(user);

    // Salvar refresh token com family_id (new session = new family)
    const tokenHash = hashToken(refreshToken);
    const familyId = crypto.randomUUID();
    await query(
      "INSERT INTO refresh_tokens (usuario_id, token_hash, jti, family_id, expira_em, ip_origem, user_agent) VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days', $5, $6)",
      [user.id, tokenHash, jti, familyId, ip, userAgent]
    );

    logger.info('login_success', { userId: user.id, ip, event: 'login_success', familyId });

    // Audit log
    await query(
      'INSERT INTO audit_log (usuario_id, acao, ip) VALUES ($1, $2, $3)',
      [user.id, 'LOGIN_SUCCESS', ip]
    ).catch(() => {}); // Non-critical — never fail login due to audit log error

    return {
      accessToken,
      refreshToken,
      usuario: { id: user.id, nome: user.nome, username: user.username, perfil: user.perfil },
    };
  }

  /**
   * Refresh token rotation com detecção de reuso (family revocation)
   * Phase 1.1 — token theft detection via family_id
   */
  async refresh(refreshToken, ip, userAgent) {
    let decoded;
    try {
      // Phase 1.3 — explicit algorithm allowlist prevents alg:none attacks
      decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET, { algorithms: JWT_ALGORITHMS });
    } catch (err) {
      throw new AuthError('Refresh token inválido');
    }

    const tokenHash = hashToken(refreshToken);
    const legacyTokenHash = legacyHashToken(refreshToken);

    const { rows } = await query(
      `SELECT rt.*, u.nome, u.username, u.perfil, u.ativo 
       FROM refresh_tokens rt 
       JOIN usuarios u ON u.id = rt.usuario_id 
       WHERE rt.token_hash = ANY($1) AND rt.expira_em > NOW()`,
      [[tokenHash, legacyTokenHash]]
    );

    if (rows.length === 0) {
      logger.error('refresh_fail: token não encontrado ou expirado', { ip, event: 'refresh_fail' });
      throw new AuthError('Refresh token não encontrado ou expirado');
    }

    const row = rows[0];
    if (!row.ativo) throw new AuthError('Usuário desativado');

    // ─── Token already used/revoked → theft detection ────────────────────────
    if (row.revogado) {
      if (row.rotacionado_em) {
        const rotatedAt = new Date(row.rotacionado_em);
        const diffMs = Date.now() - rotatedAt.getTime();

        // Grace period: tolerate concurrent refresh (double F5 / React Strict Mode)
        // Only within the brief window — NOT open replay window
        if (diffMs <= GRACE_PERIOD_MS) {
          logger.warn('refresh_grace_period: token concurrent concedido', {
            userId: row.usuario_id, ip, event: 'refresh_success', familyId: row.family_id, gracePeriod: true
          });
          const user = { id: row.usuario_id, nome: row.nome, username: row.username, perfil: row.perfil };
          const { accessToken, refreshToken: newRefreshToken, jti } = this.generateTokens(user);
          const newHash = hashToken(newRefreshToken);

          await query(
            "INSERT INTO refresh_tokens (usuario_id, token_hash, jti, family_id, expira_em, ip_origem, user_agent) VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days', $5, $6)",
            [user.id, newHash, jti, row.family_id, ip, userAgent]
          );

          return { accessToken, refreshToken: newRefreshToken, usuario: user };
        }
      }

      // ─── REAL REUSE DETECTED — revoke entire family ───────────────────────
      logger.error('refresh_reuse_detected: roubo de token detectado, revogando família inteira', {
        userId: row.usuario_id, ip, userAgent, familyId: row.family_id,
        event: 'refresh_reuse_detected'
      });

      await query(
        "UPDATE refresh_tokens SET revogado = true, revoked_reason = 'reuse_detected' WHERE family_id = $1",
        [row.family_id]
      );

      throw new AuthError('Sessão encerrada por motivos de segurança. Faça login novamente.');
    }

    // ─── Normal rotation — mark old token as used and issue new one ──────────
    await query(
      "UPDATE refresh_tokens SET revogado = true, rotacionado_em = NOW(), revoked_reason = 'rotated' WHERE token_hash = ANY($1)",
      [[tokenHash, legacyTokenHash]]
    );

    const user = { id: row.usuario_id, nome: row.nome, username: row.username, perfil: row.perfil };
    const { accessToken, refreshToken: newRefreshToken, jti } = this.generateTokens(user);
    const newHash = hashToken(newRefreshToken);

    await query(
      "INSERT INTO refresh_tokens (usuario_id, token_hash, jti, family_id, expira_em, ip_origem, user_agent) VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days', $5, $6)",
      [user.id, newHash, jti, row.family_id, ip, userAgent]
    );

    logger.info('refresh_success', {
      userId: user.id, ip, event: 'refresh_success', familyId: row.family_id
    });

    return { accessToken, refreshToken: newRefreshToken, usuario: user };
  }

  /**
   * Logout — revoga a família de tokens deste dispositivo (não todos os dispositivos)
   * Para logout global, usar logoutAll()
   */
  async logout(accessToken, refreshToken, userId) {
    // Blacklist access token in Redis for its remaining TTL
    try {
      const decoded = jwt.decode(accessToken);
      if (decoded && decoded.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await redis.setex(`bl:${hashToken(accessToken)}`, ttl, '1');
        }
      }
    } catch (err) {
      // Non-critical — always proceed with DB revocation
    }

    // Revoke the token family for this device (not all sessions — Phase 2.3)
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      const legacyTokenHash = legacyHashToken(refreshToken);
      const { rows } = await query(
        'SELECT family_id FROM refresh_tokens WHERE token_hash = ANY($1) LIMIT 1',
        [[tokenHash, legacyTokenHash]]
      );
      if (rows.length > 0) {
        await query(
          "UPDATE refresh_tokens SET revogado = true, revoked_reason = 'logout' WHERE family_id = $1",
          [rows[0].family_id]
        );
        logger.info('logout: família de tokens revogada', {
          userId, event: 'logout', familyId: rows[0].family_id
        });
        return;
      }
    }

    // Fallback: revoke by userId if no refresh token available
    await query(
      "UPDATE refresh_tokens SET revogado = true, revoked_reason = 'logout' WHERE usuario_id = $1 AND revogado = false",
      [userId]
    );
    logger.info('logout', { userId, event: 'logout' });
  }

  /**
   * Logout global — revoga TODOS os tokens do usuário em todos os dispositivos
   */
  async logoutAll(userId) {
    await query(
      "UPDATE refresh_tokens SET revogado = true, revoked_reason = 'logout_all' WHERE usuario_id = $1 AND revogado = false",
      [userId]
    );
    logger.info('logout_all: todas as sessões revogadas', { userId, event: 'logout' });
  }

  async revokeRefreshToken(refreshToken) {
    if (!refreshToken) return;
    const tokenHash = hashToken(refreshToken);
    const legacyTokenHash = legacyHashToken(refreshToken);
    const { rows } = await query(
      'SELECT family_id FROM refresh_tokens WHERE token_hash = ANY($1) LIMIT 1',
      [[tokenHash, legacyTokenHash]]
    );
    if (rows.length > 0) {
      await query(
        "UPDATE refresh_tokens SET revogado = true, revoked_reason = 'logout' WHERE family_id = $1",
        [rows[0].family_id]
      );
    }
  }

  /**
   * Busca dados do usuário autenticado
   */
  async getMe(userId) {
    const result = await query(
      'SELECT id, nome, username, perfil, ativo, ultimo_login, criado_em FROM usuarios WHERE id = $1',
      [userId]
    );
    if (result.rows.length === 0) throw new AuthError('Usuário não encontrado');
    return result.rows[0];
  }
}

module.exports = new AuthService();
