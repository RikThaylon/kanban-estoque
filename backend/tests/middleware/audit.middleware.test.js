/**
 * Testes para middleware de auditoria
 * @module tests/middleware/audit.middleware.test
 */

require('../setup');

// Mock do database
jest.mock('../../src/config/database', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  getClient: jest.fn(),
  pool: { end: jest.fn() },
}));

jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(), warn: jest.fn(), info: jest.fn(), http: jest.fn(), debug: jest.fn(),
}));

const { audit } = require('../../src/middleware/audit');
const { query } = require('../../src/config/database');

describe('Audit Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve interceptar res.json e registrar audit log em sucesso', async () => {
    const middleware = audit('CRIAR_PRODUTO', 'produtos');
    const req = { user: { id: 'user-1' }, params: {}, ip: '127.0.0.1' };
    const originalJsonFn = jest.fn();
    const res = {
      statusCode: 201,
      json: originalJsonFn,
    };
    const next = jest.fn();

    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();

    // Simular chamada de res.json como o route handler faria
    const responseData = { id: 'prod-1', nome: 'Teste' };
    res.json(responseData);

    // Deve ter chamado query para inserir audit_log
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_log'),
      expect.arrayContaining(['user-1', 'CRIAR_PRODUTO', 'produtos'])
    );
  });

  it('não deve registrar audit log quando status >= 300', async () => {
    const middleware = audit('ACAO', 'tabela');
    const req = { user: { id: 'user-1' }, params: {}, ip: '127.0.0.1' };
    const originalJsonFn = jest.fn();
    const res = {
      statusCode: 400,
      json: originalJsonFn,
    };
    const next = jest.fn();

    await middleware(req, res, next);
    res.json({ error: 'VALIDATION_ERROR' });

    expect(query).not.toHaveBeenCalled();
  });

  it('deve sanitizar dados sensíveis antes de salvar', async () => {
    const middleware = audit('CRIAR_USUARIO', 'usuarios');
    const req = { user: { id: 'user-1' }, params: {}, ip: '127.0.0.1' };
    const res = {
      statusCode: 201,
      json: jest.fn(),
    };
    const next = jest.fn();

    await middleware(req, res, next);
    
    // Response com dados sensíveis
    res.json({ id: 'usr-1', nome: 'Teste', senha_hash: 'secret_hash', email: 'test@test.com' });

    expect(query).toHaveBeenCalled();
    const savedData = JSON.parse(query.mock.calls[0][1][5]); // dados_depois
    
    // senha_hash deve estar hasheada
    expect(savedData.senha_hash).not.toBe('secret_hash');
    // email deve estar criptografado
    expect(savedData.email).not.toBe('test@test.com');
  });

  it('deve funcionar sem user autenticado (req.user null)', async () => {
    const middleware = audit('ACAO', 'tabela');
    const req = { user: undefined, params: {}, ip: '127.0.0.1' };
    const res = {
      statusCode: 200,
      json: jest.fn(),
    };
    const next = jest.fn();

    await middleware(req, res, next);
    res.json({ id: 'test' });

    expect(query).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([null]) // usuario_id null
    );
  });

  it('deve capturar erro de query silenciosamente', async () => {
    query.mockRejectedValueOnce(new Error('DB down'));
    
    const middleware = audit('ACAO', 'tabela');
    const req = { user: { id: 'u1' }, params: {}, ip: '1.1.1.1' };
    const res = { statusCode: 200, json: jest.fn() };
    const next = jest.fn();

    await middleware(req, res, next);
    
    // Não deve lançar erro — o catch interno deve absorver
    expect(() => res.json({ id: 'test' })).not.toThrow();
  });
});
