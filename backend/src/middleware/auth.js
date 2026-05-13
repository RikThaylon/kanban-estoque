const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { redis } = require('../config/redis');
const { AuthError } = require('../utils/errors');
const logger = require('../utils/logger');
const { hashToken } = require('../utils/sensitiveData');

/**
 * Middleware de autenticação JWT
 * Verifica accessToken no header Authorization
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthError('Token não fornecido');
    }

    const token = authHeader.split(' ')[1];

    // Verificar blacklist no Redis
    const isBlacklisted = await redis.get(`bl:${hashToken(token)}`);
    if (isBlacklisted) {
      throw new AuthError('Token revogado');
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      perfil: decoded.perfil,
      nome: decoded.nome,
    };
    req.token = token;
    next();
  } catch (err) {
    if (err instanceof AuthError) return next(err);
    if (err.name === 'TokenExpiredError') return next(new AuthError('Token expirado'));
    if (err.name === 'JsonWebTokenError') return next(new AuthError('Token inválido'));
    next(new AuthError('Falha na autenticação'));
  }
};

/**
 * Middleware opcional - não bloqueia se sem token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
        const isBlacklisted = await redis.get(`bl:${hashToken(token)}`);
      if (!isBlacklisted) {
        const decoded = jwt.verify(token, env.JWT_SECRET);
        req.user = { id: decoded.id, email: decoded.email, perfil: decoded.perfil, nome: decoded.nome };
        req.token = token;
      }
    }
  } catch (err) {
    // Ignora erros - autenticação é opcional
  }
  next();
};

module.exports = { authenticate, optionalAuth };
