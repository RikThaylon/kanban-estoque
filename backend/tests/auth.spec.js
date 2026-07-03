const request = require('supertest');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const app = require('../src/server');
const { hashToken } = require('../utils/sensitiveData');

jest.mock('../config/database');

describe('Auth Service (unit)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('login should fail when senha_hash is missing', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, nome: 'A', username: 'a', perfil: 'user', ativo: true }] });

    const res = await request(app).post('/api/v1/auth/login').send({ username: 'a', senha: 'x' });
    expect(res.statusCode).toBe(401);
  });

  test('refresh should rotate token and detect reuse', async () => {
    // Setup: existing refresh token row
    const fakeToken = jwt.sign({ id: 1, type: 'refresh', jti: 'j1' }, process.env.JWT_REFRESH_SECRET || 'secret', { expiresIn: '7d' });
    const tokenHash = hashToken(fakeToken);

    // First call: token exists and is not revoked
    query.mockResolvedValueOnce({ rows: [{ id: 10, usuario_id: 1, token_hash: tokenHash, revogado: false, expira_em: new Date(Date.now() + 100000), nome: 'A', username: 'a', perfil: 'user', ativo: true }], rowCount: 1 });
    // Insert new token
    query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const res1 = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: fakeToken });
    expect(res1.statusCode).toBe(200);

    // Second call simulating reuse (token marked revoked and rotacionado_em older than grace period)
    const oldDate = new Date(Date.now() - 60000).toISOString();
    query.mockResolvedValueOnce({ rows: [{ id: 10, usuario_id: 1, token_hash: tokenHash, revogado: true, rotacionado_em: oldDate, expira_em: new Date(Date.now() + 100000), nome: 'A', username: 'a', perfil: 'user', ativo: true }], rowCount: 1 });
    query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const res2 = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: fakeToken });
    expect(res2.statusCode).toBe(401);
  });

  test('refresh concurrent calls (double F5) should not throw 500', async () => {
    const fakeToken = jwt.sign({ id: 1, type: 'refresh', jti: 'j_concurrent' }, process.env.JWT_REFRESH_SECRET || 'secret', { expiresIn: '7d' });
    const tokenHash = hashToken(fakeToken);

    // Mock the DB query to take some time, so they interleave
    query.mockImplementation(async (sql) => {
      // Simulate DB latency
      await new Promise(r => setTimeout(r, 10));
      if (sql.includes('SELECT rt.*')) {
        return { 
          rows: [{ id: 11, usuario_id: 1, token_hash: tokenHash, revogado: false, expira_em: new Date(Date.now() + 100000), nome: 'A', username: 'a', perfil: 'user', ativo: true }],
          rowCount: 1
        };
      }
      return { rows: [], rowCount: 1 };
    });

    // Fire two requests concurrently
    const [res1, res2] = await Promise.all([
      request(app).post('/api/v1/auth/refresh').send({ refreshToken: fakeToken }),
      request(app).post('/api/v1/auth/refresh').send({ refreshToken: fakeToken })
    ]);

    // Neither should be 500
    expect(res1.statusCode).not.toBe(500);
    expect(res2.statusCode).not.toBe(500);
    // Because of mock simplicity, both might get 200, which is acceptable in the grace period if handled properly
  });
});
