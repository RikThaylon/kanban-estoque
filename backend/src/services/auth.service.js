const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { env } = require('../config/env');
const { query } = require('../config/database');
const { redis } = require('../config/redis');
const { AuthError } = require('../utils/errors');
const logger = require('../utils/logger');
const { hashToken, legacyHashToken } = require('../utils/sensitiveData');

class AuthService {
  /**
   * Gera par de tokens (access + refresh)
   */
  generateTokens(user, rememberMe = false) {
    const accessToken = jwt.sign(
      { id: user.id, username: user.username, perfil: user.perfil, nome: user.nome },
      env.JWT_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRY }
    );
    const refreshExpiresIn = rememberMe ? '30d' : '1d';
    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh', rememberMe },
      env.JWT_REFRESH_SECRET,
      { expiresIn: refreshExpiresIn }
    );
    return { accessToken, refreshToken };
  }

  /**
   * Login com username e senha
   */
  async login(username, senha, ip, userAgent, rememberMe = false) {
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

    const tokens = this.generateTokens(user, rememberMe);

    // Salvar refresh token no banco com family_id e absolute_ttl
    const tokenHash = hashToken(tokens.refreshToken);
    const familyId = uuidv4();
    const intervalStr = rememberMe ? '30 days' : '1 day';

    await query(
      `INSERT INTO refresh_tokens 
       (usuario_id, token_hash, family_id, absolute_ttl, expira_em, ip_origem, user_agent) 
       VALUES ($1, $2, $3, NOW() + INTERVAL '${intervalStr}', NOW() + INTERVAL '${intervalStr}', $4, $5)`,
      [user.id, tokenHash, familyId, ip, userAgent]
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

    const tokenHash = hashToken(refreshToken);
    const legacyTokenHash = legacyHashToken(refreshToken);
    const result = await query(
      'SELECT rt.*, u.nome, u.username, u.perfil, u.ativo FROM refresh_tokens rt JOIN usuarios u ON u.id = rt.usuario_id WHERE rt.token_hash = ANY($1) AND rt.absolute_ttl > NOW() AND rt.expira_em > NOW()',
      [[tokenHash, legacyTokenHash]]
    );

    if (result.rows.length === 0) throw new AuthError('Refresh token inválido ou expirado');
    const row = result.rows[0];
    if (!row.ativo) throw new AuthError('Usuário desativado');

    if (row.revogado || row.revoked_at) {
      // Race condition mitigation: Grace Period via Redis
      const cachedNewToken = await redis.get(`grace:${tokenHash}`);
      if (cachedNewToken) {
        logger.warn('Token Refresh Grace Period ativado (concorrência de rede/abas)', { userId: row.usuario_id, ip });
        const user = { id: row.usuario_id, nome: row.nome, username: row.username, perfil: row.perfil };
        // Generate a new access token to accompany the cached refresh token
        const accessToken = jwt.sign(
          { id: user.id, username: user.username, perfil: user.perfil, nome: user.nome },
          env.JWT_SECRET,
          { expiresIn: env.JWT_ACCESS_EXPIRY }
        );
        return { accessToken, refreshToken: cachedNewToken, usuario: user };
      }
      
      // Token Reuse Detection: Revoke the whole family
      logger.error('Possível roubo de token detectado (Reuso fora do grace period)', { userId: row.usuario_id, ip });
      await query('UPDATE refresh_tokens SET revogado = true, revoked_at = NOW() WHERE family_id = $1', [row.family_id]);
      throw new AuthError('Sessão comprometida por segurança. Faça login novamente.');
    }

    // Normal Rotation
    const user = { id: row.usuario_id, nome: row.nome, username: row.username, perfil: row.perfil };
    const rememberMe = decoded.rememberMe === true;
    const tokens = this.generateTokens(user, rememberMe);
    const newHash = hashToken(tokens.refreshToken);

    // Save the new plaintext token in Redis for 15s (Grace Period)
    await redis.setex(`grace:${tokenHash}`, 15, tokens.refreshToken);

    // Revoke old token and link to new one
    await query(`
      UPDATE refresh_tokens 
      SET revogado = true, revoked_at = NOW(), rotacionado_em = NOW(), replaced_by_token_hash = $1
      WHERE id = $2`, 
      [newHash, row.id]
    );

    // Insert new token in the same family
    const intervalStr = rememberMe ? '30 days' : '1 day';
    await query(`
      INSERT INTO refresh_tokens 
      (usuario_id, token_hash, family_id, absolute_ttl, expira_em, ip_origem, user_agent) 
      VALUES ($1, $2, $3, $4, NOW() + INTERVAL '${intervalStr}', $5, $6)`,
      [user.id, newHash, row.family_id, row.absolute_ttl, ip, userAgent]
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
          await redis.setex(`bl:${hashToken(accessToken)}`, ttl, '1');
        }
      }
    } catch (err) {
      // Ignora erro de decode
    }

    await query('UPDATE refresh_tokens SET revogado = true, revoked_at = NOW() WHERE usuario_id = $1 AND (revogado = false OR revogado IS NULL)', [userId]);
  }

  async revokeRefreshToken(refreshToken) {
    if (!refreshToken) return;
    const tokenHash = hashToken(refreshToken);
    const legacyTokenHash = legacyHashToken(refreshToken);
    await query('UPDATE refresh_tokens SET revogado = true, revoked_at = NOW() WHERE token_hash = ANY($1)', [[tokenHash, legacyTokenHash]]);
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
