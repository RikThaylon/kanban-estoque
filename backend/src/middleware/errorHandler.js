const { AppError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');
const { env } = require('../config/env');

/**
 * Middleware global de tratamento de erros
 */
const errorHandler = (err, req, res, next) => {
  // Log do erro completo no servidor
  if (err.statusCode >= 500 || !err.isOperational) {
    logger.error('Erro interno', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: req.user?.id,
    });
  } else {
    logger.warn('Erro operacional', { message: err.message, code: err.code, path: req.path });
  }

  // Erro de validação
  if (err instanceof ValidationError) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: err.message,
      code: 400,
      errors: err.errors,
    });
  }

  // Erro operacional conhecido
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      code: err.statusCode,
    });
  }

  // Erro do PostgreSQL (constraint violation)
  if (err.code === '23505') {
    return res.status(409).json({
      error: 'CONFLICT',
      message: 'Registro duplicado',
      code: 409,
    });
  }

  // Erro genérico - nunca expor stack em produção
  return res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor',
    code: 500,
  });
};

module.exports = { errorHandler };
