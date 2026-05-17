/**
 * Testes de integração para rotas de autenticação
 * @module tests/integration/auth.routes.test
 */

require('../setup');

// Mocks ANTES de importar o app
jest.mock('../../src/config/database', () => {
  const mockQuery = jest.fn();
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };
  return {
    query: mockQuery,
    getClient: jest.fn().mockResolvedValue(mockClient),
    pool: { end: jest.fn() },
    _mockClient: mockClient,
  };
});

jest.mock('../../src/config/redis', () => {
  const store = new Map();
  return {
    redis: {
      isStub: true,
      async get(key) { const i = store.get(key); if (!i) return null; if (i.exp && i.exp < Date.now()) { store.delete(key); return null; } return i.value; },
      async setex(key, sec, val) { store.set(key, { value: val, exp: Date.now() + sec * 1000 }); return 'OK'; },
      async set(key, val) { store.set(key, { value: val, exp: null }); return 'OK'; },
      async del(key) { return store.delete(key) ? 1 : 0; },
      _store: store,
      on() {}, connect() {}, quit() {},
    },
    connectRedis: jest.fn(),
  };
});

jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(), warn: jest.fn(), info: jest.fn(), http: jest.fn(), debug: jest.fn(),
}));

const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../../src/app');
const { query } = require('../../src/config/database');
const { USERS, authHeader } = require('../helpers/auth');

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/auth/login', () => {
    it('deve retornar 400 quando username está vazio', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: '', senha: 'senha123' });
      
      expect(res.status).toBe(400);
    });

    it('deve retornar 400 quando senha tem menos de 6 caracteres', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'admin', senha: '123' });
      
      expect(res.status).toBe(400);
    });

    it('deve retornar 401 para usuário inexistente', async () => {
      query.mockResolvedValueOnce({ rows: [] }); // SELECT usuario
      
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'naoexiste', senha: 'senha123' });
      
      expect(res.status).toBe(401);
    });

    it('deve retornar token para credenciais válidas', async () => {
      const senhaHash = await bcrypt.hash('senha123', 4);
      query
        .mockResolvedValueOnce({ rows: [{ // SELECT usuario
          id: 'user-1', nome: 'Admin', username: 'admin',
          senha_hash: senhaHash, perfil: 'admin', ativo: true,
          tentativas_login: 0, bloqueado_ate: null,
        }]})
        .mockResolvedValueOnce({ rows: [] }) // UPDATE tentativas
        .mockResolvedValueOnce({ rows: [] }) // INSERT refresh_tokens
        .mockResolvedValueOnce({ rows: [] }); // INSERT audit_log
      
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'admin', senha: 'senha123' });
      
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.usuario).toBeDefined();
      expect(res.body.usuario.perfil).toBe('admin');
      // refreshToken não deve aparecer no body (vai no cookie)
      expect(res.body.refreshToken).toBeUndefined();
    });

    it('deve retornar 401 para senha incorreta', async () => {
      const senhaHash = await bcrypt.hash('senha_certa', 4);
      query
        .mockResolvedValueOnce({ rows: [{
          id: 'user-1', nome: 'Admin', username: 'admin',
          senha_hash: senhaHash, perfil: 'admin', ativo: true,
          tentativas_login: 0, bloqueado_ate: null,
        }]})
        .mockResolvedValueOnce({ rows: [] }); // UPDATE tentativas_login
      
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'admin', senha: 'senha_errada' });
      
      expect(res.status).toBe(401);
    });

    it('deve retornar 401 para usuário desativado', async () => {
      query.mockResolvedValueOnce({ rows: [{
        id: 'user-1', username: 'inativo', senha_hash: 'x',
        perfil: 'admin', ativo: false,
      }]});
      
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'inativo', senha: 'senha123' });
      
      expect(res.status).toBe(401);
    });

    it('deve retornar 401 para conta bloqueada', async () => {
      const futuro = new Date(Date.now() + 15 * 60000).toISOString();
      query.mockResolvedValueOnce({ rows: [{
        id: 'user-1', username: 'bloqueado', senha_hash: 'x',
        perfil: 'admin', ativo: true, bloqueado_ate: futuro,
      }]});
      
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'bloqueado', senha: 'senha123' });
      
      expect(res.status).toBe(401);
      expect(res.body.message).toContain('bloqueada');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('deve retornar dados do usuário autenticado', async () => {
      query.mockResolvedValueOnce({ rows: [{
        id: USERS.admin.id, nome: 'Admin', username: 'admin',
        perfil: 'admin', ativo: true, ultimo_login: null, criado_em: new Date().toISOString(),
      }]});

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', authHeader('admin'));
      
      expect(res.status).toBe(200);
      expect(res.body.username).toBe('admin');
    });

    it('deve retornar 401 sem token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('deve fazer logout com sucesso', async () => {
      query.mockResolvedValue({ rows: [] }); // UPDATE refresh_tokens
      
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', authHeader('admin'));
      
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Logout');
    });

    it('deve aceitar logout sem token (optionalAuth)', async () => {
      query.mockResolvedValue({ rows: [] });
      
      const res = await request(app)
        .post('/api/v1/auth/logout');
      
      expect(res.status).toBe(200);
    });
  });
});
