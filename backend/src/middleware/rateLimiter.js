const rateLimit = require('express-rate-limit');

// Login: 10 tentativas / 15 min por IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'RATE_LIMIT', message: 'Muitas tentativas de login. Tente novamente em 15 minutos.', code: 429 },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
});

// API geral: 200 req / 15 min por usuário
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'RATE_LIMIT', message: 'Limite de requisições excedido.', code: 429 },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
});

// POST: 30 req / min por usuário
const createLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'RATE_LIMIT', message: 'Limite de criação excedido. Aguarde 1 minuto.', code: 429 },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
});

module.exports = { loginLimiter, apiLimiter, createLimiter };
