const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { loginLimiter, refreshLimiter } = require('../middleware/rateLimiter');
const { antiCsrf } = require('../middleware/csrf');
const authService = require('../services/auth.service');
const { env } = require('../config/env');

const router = express.Router();
const REFRESH_COOKIE = 'kanban_refresh_token';

// Phase 1.2 — httpOnly + Secure + SameSite=Strict for production
// SameSite=None is required for cross-origin cookie (Render frontend ↔ backend on different domains)
// but must always be paired with Secure=true
const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/api/v1/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const readCookie = (req, name) => {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const found = raw
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : null;
};

const sendAuthResponse = (res, result) => {
  res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions);
  res.set('Cache-Control', 'no-store');
  const { refreshToken, ...safeResult } = result;
  res.json(safeResult);
};

// ─── Login ───────────────────────────────────────────────────────────────────
router.post('/login',
  loginLimiter,
  [
    body('username').isString().trim().isLength({ min: 1, max: 60 }).withMessage('Usuario obrigatorio'),
    body('senha').isLength({ min: 6, max: 100 }).trim().withMessage('Senha deve ter entre 6 e 100 caracteres'),
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { username, senha, latitude, longitude } = req.body;
      const result = await authService.login(
        username,
        senha,
        req.ip,
        req.get('user-agent'),
        latitude,
        longitude
      );
      sendAuthResponse(res, result);
    } catch (err) {
      next(err);
    }
  }
);

// ─── Refresh ─────────────────────────────────────────────────────────────────
router.post('/refresh',
  refreshLimiter,
  antiCsrf,
  [body('refreshToken').optional().isString().notEmpty().withMessage('Refresh token obrigatorio')],
  validate,
  async (req, res, next) => {
    try {
      const refreshToken = req.body.refreshToken || readCookie(req, REFRESH_COOKIE);
      const result = await authService.refresh(refreshToken, req.ip, req.get('user-agent'));
      sendAuthResponse(res, result);
    } catch (err) {
      next(err);
    }
  }
);

// ─── Logout (this device) ────────────────────────────────────────────────────
router.post('/logout', optionalAuth, antiCsrf, async (req, res, next) => {
  try {
    const refreshToken = readCookie(req, REFRESH_COOKIE);
    if (req.token && req.user?.id) {
      // Phase 2.3 — revoke token family (not all sessions)
      await authService.logout(req.token, refreshToken, req.user.id);
    } else {
      await authService.revokeRefreshToken(refreshToken);
    }
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions, maxAge: undefined });
    res.set('Cache-Control', 'no-store');
    res.json({ message: 'Logout realizado com sucesso' });
  } catch (err) {
    next(err);
  }
});

// ─── Logout all devices ──────────────────────────────────────────────────────
router.post('/logout-all', authenticate, antiCsrf, async (req, res, next) => {
  try {
    await authService.logoutAll(req.user.id);
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions, maxAge: undefined });
    res.set('Cache-Control', 'no-store');
    res.json({ message: 'Todas as sessões encerradas com sucesso' });
  } catch (err) {
    next(err);
  }
});

// ─── Me ──────────────────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
