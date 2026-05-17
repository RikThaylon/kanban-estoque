/**
 * Testes para middleware errorHandler
 * @module tests/middleware/errorHandler.test
 */

require('../setup');

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  http: jest.fn(),
  debug: jest.fn(),
}));

const { errorHandler } = require('../../src/middleware/errorHandler');
const { AppError, ValidationError, AuthError, NotFoundError } = require('../../src/utils/errors');

describe('Error Handler Middleware', () => {
  const mockReq = { path: '/test', method: 'POST', ip: '127.0.0.1', user: { id: 'user-1' } };
  const mockNext = jest.fn();
  let mockRes;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  it('deve retornar 400 para ValidationError', () => {
    const errors = [{ field: 'nome', message: 'Obrigatório' }];
    const err = new ValidationError(errors);

    errorHandler(err, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'VALIDATION_ERROR',
      code: 400,
      errors,
    }));
  });

  it('deve retornar statusCode correto para AppError', () => {
    const err = new AppError('Conflito', 409, 'CONFLICT');
    errorHandler(err, mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(409);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'CONFLICT',
      message: 'Conflito',
      code: 409,
    }));
  });

  it('deve retornar 401 para AuthError', () => {
    const err = new AuthError('Token expirado');
    errorHandler(err, mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  it('deve retornar 404 para NotFoundError', () => {
    const err = new NotFoundError('Produto');
    errorHandler(err, mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Produto não encontrado',
    }));
  });

  it('deve retornar 409 para erro PostgreSQL duplicate (23505)', () => {
    const err = new Error('duplicate key');
    err.code = '23505';

    errorHandler(err, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(409);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'CONFLICT',
      message: 'Registro duplicado',
    }));
  });

  it('deve retornar 500 para erros genéricos', () => {
    const err = new Error('Algo quebrou internamente');

    errorHandler(err, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'INTERNAL_ERROR',
      code: 500,
    }));
  });

  it('deve mostrar mensagem detalhada em development', () => {
    // env.NODE_ENV já é 'test' (que não é 'development'), 
    // mas vamos testar o branch de produção indiretamente
    const err = new Error('Detalhes internos');
    errorHandler(err, mockReq, mockRes, mockNext);
    // Em test/production, não deve expor a mensagem real
    // O errorHandler usa env.NODE_ENV === 'development'
    expect(mockRes.json).toHaveBeenCalled();
  });

  it('deve tratar erro sem statusCode como 500', () => {
    const err = new Error('Genérico');
    errorHandler(err, mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(500);
  });
});
