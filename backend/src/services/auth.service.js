const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { env } = require('../config/env');
const { query } = require('../config/database');
const { redis } = require('../config/redis');
const { AuthError, AppError } = require('../utils/errors');
const logger = require('../utils/logger');

class AuthService {
  /**
   * Gera par de tokens (access + refresh)
   */
  generateTokens(user) {
    const accessToken = jwt.sign(
      { id: user.id, username: user.username, perfil: user.perfil, nome: user.nome },
      env.JWT_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRY }
    );
    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRY }
    );
    return { accessToken, refreshToken };
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
      logger.warn('Tentativa de login com username inexistente', { username, ip });
      throw new AuthError('Credenciais inválidas');
    }

    if (!user.ativo) throw new AuthError('Usuário desativado');

    // Verificar bloqueio
    if (user.bloqueado_ate && new Date(user.bloqueado_ate) > new Date()) {
      const minutosRestantes = Math.ceil((new Date(user.bloqueado_ate) - new Date()) / 60000);
      throw new AuthError(`Conta bloqueada. Tente novamente em ${minutosRestantes} minutos.`);
    }

    const senhaValida = await bcrypt.compare(senha, user.senha_hash);
    if (!senhaValida) {
      const tentativas = (user.tentativas_login || 0) + 1;
      if (tentativas >= 5) {
        await query(
          'UPDATE usuarios SET tentativas_login = $1, bloqueado_ate = NOW() + INTERVAL \'15 minutes\' WHERE id = $2',
          [tentativas, user.id]
        );
        logger.warn('Usuário bloqueado após 5 tentativas', { userId: user.id, ip });
        throw new AuthError('Conta bloqueada por 15 minutos após 5 tentativas falhas.');
      }
      await query('UPDATE usuarios SET tentativas_login = $1 WHERE id = $2', [tentativas, user.id]);
      throw new AuthError(`Credenciais inválidas. ${5 - tentativas} tentativas restantes.`);
    }

    // Reset tentativas e atualiza ultimo_login
    await query(
      'UPDATE usuarios SET tentativas_login = 0, bloqueado_ate = NULL, ultimo_login = NOW() WHERE id = $1',
      [user.id]
    );

    const tokens = this.generateTokens(user);

    // Salvar refresh token no banco
    const tokenHash = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex');
    await query(
      'INSERT INTO refresh_tokens (usuario_id, token_hash, expira_em, ip_origem, user_agent) VALUES ($1, $2, NOW() + INTERVAL \'7 days\', $3, $4)',
      [user.id, tokenHash, ip, userAgent]
    );

    // Audit log
    await query(
      'INSERT INTO audit_log (usuario_id, acao, ip) VALUES ($1, $2, $3)',
      [user.id, 'LOGIN_SUCCESS', ip]
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      usuario: { id: user.id, nome: user.nome, username: user.username, perfil: user.perfil },
    };
  }

  /**
   * Refresh token rotation
   */
  async refresh(refreshToken, ip, userAgent) {
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    } catch (err) {
      throw new AuthError('Refresh token inválido');
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const result = await query(
      'SELECT rt.*, u.nome, u.username, u.perfil, u.ativo FROM refresh_tokens rt JOIN usuarios u ON u.id = rt.usuario_id WHERE rt.token_hash = $1 AND rt.revogado = false AND rt.expira_em > NOW()',
      [tokenHash]
    );

    if (result.rows.length === 0) throw new AuthError('Refresh token inválido ou expirado');
    const row = result.rows[0];
    if (!row.ativo) throw new AuthError('Usuário desativado');

    // Revogar token anterior (rotation)
    await query('UPDATE refresh_tokens SET revogado = true WHERE token_hash = $1', [tokenHash]);

    const user = { id: row.usuario_id, nome: row.nome, username: row.username, perfil: row.perfil };
    const tokens = this.generateTokens(user);

    // Salvar novo refresh token
    const newHash = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex');
    await query(
      'INSERT INTO refresh_tokens (usuario_id, token_hash, expira_em, ip_origem, user_agent) VALUES ($1, $2, NOW() + INTERVAL \'7 days\', $3, $4)',
      [user.id, newHash, ip, userAgent]
    );

    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, usuario: user };
  }

  /**
   * Logout - blacklist do access token e revoga refresh
   */
  async logout(accessToken, userId) {
    try {
      const decoded = jwt.decode(accessToken);
      if (decoded && decoded.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await redis.setex(`bl:${accessToken}`, ttl, '1');
        }
      }
    } catch (err) {
      // Ignora erro de decode
    }

    await query('UPDATE refresh_tokens SET revogado = true WHERE usuario_id = $1 AND revogado = false', [userId]);
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
