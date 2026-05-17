/**
 * Testes para middleware de validação (express-validator wrapper)
 * @module tests/middleware/validate.middleware.test
 */

require('../setup');

const { validate } = require('../../src/middleware/validate');
const { validationResult, body } = require('express-validator');

describe('Validate Middleware', () => {
  // Helper para simular express-validator
  const runValidation = async (rules, bodyData) => {
    const req = { body: bodyData, headers: {}, query: {}, params: {} };
    const res = {};
    
    // Rodar cada regra de validação
    for (const rule of rules) {
      await rule.run(req);
    }
    
    return req;
  };

  it('deve chamar next() quando validação passa', async () => {
    const rules = [body('nome').isString().notEmpty()];
    const req = await runValidation(rules, { nome: 'Teste' });
    const next = jest.fn();

    validate(req, {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('deve chamar next(ValidationError) quando validação falha', async () => {
    const rules = [body('nome').isString().notEmpty().withMessage('Nome obrigatório')];
    const req = await runValidation(rules, { nome: '' });
    const next = jest.fn();

    validate(req, {}, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    }));
  });

  it('deve incluir campo e mensagem no erro de validação', async () => {
    const rules = [
      body('email').isEmail().withMessage('Email inválido'),
    ];
    const req = await runValidation(rules, { email: 'not_an_email' });
    const next = jest.fn();

    validate(req, {}, next);

    const error = next.mock.calls[0][0];
    expect(error.errors).toBeDefined();
    expect(error.errors[0]).toEqual(expect.objectContaining({
      field: 'email',
      message: 'Email inválido',
    }));
  });

  it('deve reportar múltiplos erros de validação', async () => {
    const rules = [
      body('nome').notEmpty().withMessage('Nome obrigatório'),
      body('qtd').isFloat({ gt: 0 }).withMessage('Quantidade > 0'),
    ];
    const req = await runValidation(rules, { nome: '', qtd: -1 });
    const next = jest.fn();

    validate(req, {}, next);

    const error = next.mock.calls[0][0];
    expect(error.errors.length).toBeGreaterThanOrEqual(2);
  });
});
