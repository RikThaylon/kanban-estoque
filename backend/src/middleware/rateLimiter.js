const rateLimit = require('express-rate-limit');
const { env } = require('../config/env');

// Login: 10 tentativas falhas / 15 min por IP
// CRÍTICO: skipSuccessfulRequests=true garante que apenas falhas (4xx/5xx) incrementam
// o contador. Logins bem-sucedidos NÃO são contabilizados.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true, // ← FIX: não penaliza logins corretos
  message: { error: 'RATE_LIMIT', message: 'Muitas tentativas de login. Tente novamente em 15 minutos.', code: 429 },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
});

// API geral: 200 req / 15 min por usuário
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.RATE_LIMIT_MAX,
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

// Refresh token: 60 req / 15 min por IP
// Alto o suficiente para múltiplas abas + retries de rede legítimos,
// mas capaz de bloquear abuso automatizado
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'RATE_LIMIT', message: 'Muitas tentativas de refresh. Aguarde alguns minutos.', code: 429 },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
});

module.exports = { loginLimiter, apiLimiter, createLimiter, refreshLimiter };
