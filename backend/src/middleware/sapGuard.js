const { env } = require('../config/env');

/**
 * Bloqueia operações de escrita (POST, PUT, PATCH, DELETE) se o sistema
 * estiver operando no modo de integração SAP (somente leitura para operações locais).
 */
const sapGuard = (req, res, next) => {
  if (env.SAP_MODE === true && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return res.status(403).json({
      error: 'FORBIDDEN_IN_SAP_MODE',
      message: 'Operação de escrita bloqueada. O sistema está configurado para o modo de integração SAP (apenas leitura).',
      code: 403
    });
  }
  next();
};

module.exports = { sapGuard };
