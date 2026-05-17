/**
 * Testes unitários para classes de erro customizadas
 * @module tests/unit/errors.test
 */

const {
  AppError,
  ValidationError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} = require('../../src/utils/errors');

describe('Custom Error Classes', () => {
  describe('AppError', () => {
    it('deve criar erro com valores padrão', () => {
      const err = new AppError('Erro genérico');
      expect(err.message).toBe('Erro genérico');
      expect(err.statusCode).toBe(500);
      expect(err.code).toBe('INTERNAL_ERROR');
      expect(err.isOperational).toBe(true);
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
    });

    it('deve aceitar statusCode e code customizados', () => {
      const err = new AppError('Custom', 422, 'CUSTOM_CODE');
      expect(err.statusCode).toBe(422);
      expect(err.code).toBe('CUSTOM_CODE');
    });

    it('deve ter stack trace', () => {
      const err = new AppError('com stack');
      expect(err.stack).toBeDefined();
      expect(err.stack).toContain('errors.test');
    });
  });

  describe('ValidationError', () => {
    it('deve criar erro de validação com array de erros', () => {
      const errors = [
        { field: 'nome', message: 'Obrigatório' },
        { field: 'email', message: 'Formato inválido' },
      ];
      const err = new ValidationError(errors);
      expect(err.message).toBe('Erro de validação');
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.errors).toEqual(errors);
      expect(err).toBeInstanceOf(AppError);
    });
  });

  describe('AuthError', () => {
    it('deve criar erro de autenticação com mensagem padrão', () => {
      const err = new AuthError();
      expect(err.message).toBe('Não autorizado');
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('AUTH_ERROR');
    });

    it('deve aceitar mensagem customizada', () => {
      const err = new AuthError('Token expirado');
      expect(err.message).toBe('Token expirado');
      expect(err.statusCode).toBe(401);
    });
  });

  describe('ForbiddenError', () => {
    it('deve criar erro 403 com mensagem padrão', () => {
      const err = new ForbiddenError();
      expect(err.message).toBe('Acesso negado');
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('FORBIDDEN');
    });

    it('deve aceitar mensagem customizada', () => {
      const err = new ForbiddenError('Sem permissão para editar');
      expect(err.message).toBe('Sem permissão para editar');
    });
  });

  describe('NotFoundError', () => {
    it('deve criar erro 404 com resource padrão', () => {
      const err = new NotFoundError();
      expect(err.message).toBe('Recurso não encontrado');
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe('NOT_FOUND');
    });

    it('deve incluir nome do recurso na mensagem', () => {
      const err = new NotFoundError('Produto');
      expect(err.message).toBe('Produto não encontrado');
    });
  });

  describe('ConflictError', () => {
    it('deve criar erro 409 com mensagem padrão', () => {
      const err = new ConflictError();
      expect(err.message).toBe('Conflito de dados');
      expect(err.statusCode).toBe(409);
      expect(err.code).toBe('CONFLICT');
    });
  });

  describe('Herança', () => {
    it('todos os erros devem ser instanceof AppError', () => {
      expect(new ValidationError([])).toBeInstanceOf(AppError);
      expect(new AuthError()).toBeInstanceOf(AppError);
      expect(new ForbiddenError()).toBeInstanceOf(AppError);
      expect(new NotFoundError()).toBeInstanceOf(AppError);
      expect(new ConflictError()).toBeInstanceOf(AppError);
    });

    it('todos os erros devem ser instanceof Error nativo', () => {
      expect(new AppError('a')).toBeInstanceOf(Error);
      expect(new AuthError()).toBeInstanceOf(Error);
    });

    it('isOperational deve ser true em todos os erros', () => {
      expect(new AppError('a').isOperational).toBe(true);
      expect(new AuthError().isOperational).toBe(true);
      expect(new NotFoundError().isOperational).toBe(true);
    });
  });
});
