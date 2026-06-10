require('../setup');

jest.mock('../../src/config/database', () => {
  const mq = jest.fn();
  return { query: mq, getClient: jest.fn(), pool: { end: jest.fn() } };
});
jest.mock('../../src/config/redis', () => ({
  redis: { isStub: true, get: jest.fn().mockResolvedValue(null), on() {}, connect() {}, quit() {} },
  connectRedis: jest.fn(),
}));
jest.mock('../../src/utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), http: jest.fn(), debug: jest.fn() }));

const request = require('supertest');
const app = require('../../src/app');
const { query } = require('../../src/config/database');
const { authHeader } = require('../helpers/auth');

describe('Usuarios Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ rows: [], rowCount: 1 });
  });

  it('POST /api/v1/usuarios rejeita senha abaixo do minimo', async () => {
    const res = await request(app)
      .post('/api/v1/usuarios')
      .set('Authorization', authHeader('admin'))
      .send({ nome: 'QA User', username: 'qa_user', senha: '1234567', perfil: 'comprador' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.errors.some((e) => e.field === 'senha')).toBe(true);
  });

  it('POST /api/v1/usuarios rejeita senha com espaco', async () => {
    const res = await request(app)
      .post('/api/v1/usuarios')
      .set('Authorization', authHeader('admin'))
      .send({ nome: 'QA User', username: 'qa_user', senha: 'Senha 123', perfil: 'comprador' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.errors.some((e) => e.field === 'senha')).toBe(true);
  });

  it('POST /api/v1/usuarios/:id/reset-senha rejeita nova senha com espaco', async () => {
    const res = await request(app)
      .post('/api/v1/usuarios/user-1/reset-senha')
      .set('Authorization', authHeader('admin'))
      .send({ nova_senha: 'Nova 1234' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.errors.some((e) => e.field === 'nova_senha')).toBe(true);
  });
});
