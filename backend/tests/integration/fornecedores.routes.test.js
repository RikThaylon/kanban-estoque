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

describe('Fornecedores Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ rows: [], rowCount: 1 });
  });

  it('POST /api/v1/fornecedores normaliza modal padrao antes de salvar', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 'f1', nome: 'Fornecedor QA', modal_padrao: 'motoboy' }],
      rowCount: 1,
    });

    const res = await request(app)
      .post('/api/v1/fornecedores')
      .set('Authorization', authHeader('admin'))
      .send({
        nome: 'Fornecedor QA',
        modal_padrao: 'MOTOBOY',
        estado: 'sp',
        prazo_pagamento_dias: 30,
      });

    expect(res.status).toBe(201);
    const insertCall = query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO fornecedores'));
    expect(insertCall[1][6]).toBe('SP');
    expect(insertCall[1][7]).toBe('motoboy');
  });

  it('POST /api/v1/fornecedores rejeita modal invalido com 400', async () => {
    const res = await request(app)
      .post('/api/v1/fornecedores')
      .set('Authorization', authHeader('admin'))
      .send({ nome: 'Fornecedor QA', modal_padrao: 'DRONE' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.errors.some((e) => e.field === 'modal_padrao')).toBe(true);
  });
});
