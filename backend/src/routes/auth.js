const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');
const authService = require('../services/auth.service');

const router = express.Router();

// POST /api/v1/auth/login
router.post('/login',
  loginLimiter,
  [
    body('username').isString().trim().isLength({ min: 1, max: 60 }).withMessage('Usuário obrigatório'),
    body('senha').isLength({ min: 6, max: 100 }).trim().withMessage('Senha deve ter entre 6 e 100 caracteres'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { username, senha } = req.body;
      const result = await authService.login(username, senha, req.ip, req.get('user-agent'));
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/refresh
router.post('/refresh',
  [body('refreshToken').isString().notEmpty().withMessage('Refresh token obrigatório')],
  validate,
  async (req, res, next) => {
    try {
      const result = await authService.refresh(req.body.refreshToken, req.ip, req.get('user-agent'));
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/logout
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await authService.logout(req.token, req.user.id);
    res.json({ message: 'Logout realizado com sucesso' });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
