/**
 * Testes para middleware de autenticação JWT
 * @module tests/middleware/auth.middleware.test
 */

require('../setup');

const jwt = require('jsonwebtoken');
const { TEST_SECRET } = require('../helpers/auth');

// Mock do redis ANTES de importar o middleware
jest.mock('../../src/config/redis', () => {
  const store = new Map();
  return {
    redis: {
      isStub: true,
      async get(key) {
        const item = store.get(key);
        if (!item) return null;
        if (item.exp && item.exp < Date.now()) { store.delete(key); return null; }
        return item.value;
      },
      async setex(key, seconds, value) { store.set(key, { value, exp: Date.now() + seconds * 1000 }); return 'OK'; },
      async set(key, value) { store.set(key, { value, exp: null }); return 'OK'; },
      async del(key) { return store.delete(key) ? 1 : 0; },
      _store: store,
    },
    connectRedis: jest.fn(),
  };
});

const { authenticate, optionalAuth } = require('../../src/middleware/auth');
const { redis } = require('../../src/config/redis');
const { hashToken } = require('../../src/utils/sensitiveData');

describe('Auth Middleware', () => {
  const mockRes = () => ({});
  
  beforeEach(() => {
    redis._store.clear();
  });

  describe('authenticate', () => {
    it('deve rejeitar request sem Authorization header', async () => {
      const req = { headers: {} };
      const next = jest.fn();
      await authenticate(req, mockRes(), next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 401,
        message: expect.stringContaining('Token não fornecido'),
      }));
    });

    it('deve rejeitar Authorization sem Bearer', async () => {
      const req = { headers: { authorization: 'Basic abc123' } };
      const next = jest.fn();
      await authenticate(req, mockRes(), next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });

    it('deve rejeitar token JWT inválido', async () => {
      const req = { headers: { authorization: 'Bearer invalid_token_here' } };
      const next = jest.fn();
      await authenticate(req, mockRes(), next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });

    it('deve aceitar token válido e popular req.user', async () => {
      const payload = { id: 'user-123', perfil: 'admin', nome: 'Admin' };
      const token = jwt.sign(payload, TEST_SECRET, { expiresIn: '1h' });
      const req = { headers: { authorization: `Bearer ${token}` } };
      const next = jest.fn();
      
      await authenticate(req, mockRes(), next);
      
      expect(next).toHaveBeenCalledWith();
      expect(req.user.id).toBe('user-123');
      expect(req.user.perfil).toBe('admin');
      expect(req.token).toBe(token);
    });

    it('deve rejeitar token expirado', async () => {
      const token = jwt.sign({ id: 'user-1' }, TEST_SECRET, { expiresIn: '-1s' });
      const req = { headers: { authorization: `Bearer ${token}` } };
      const next = jest.fn();
      
      await authenticate(req, mockRes(), next);
      
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 401,
        message: expect.stringContaining('expirado'),
      }));
    });

    it('deve rejeitar token na blacklist', async () => {
      const token = jwt.sign({ id: 'user-1', perfil: 'admin' }, TEST_SECRET, { expiresIn: '1h' });
      const tokenHash = hashToken(token);
      await redis.setex(`bl:${tokenHash}`, 3600, '1');
      
      const req = { headers: { authorization: `Bearer ${token}` } };
      const next = jest.fn();
      
      await authenticate(req, mockRes(), next);
      
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 401,
        message: expect.stringContaining('revogado'),
      }));
    });

    it('deve rejeitar token assinado com secret errado', async () => {
      const token = jwt.sign({ id: 'user-1' }, 'wrong_secret_that_is_long_enough_32chars!!', { expiresIn: '1h' });
      const req = { headers: { authorization: `Bearer ${token}` } };
      const next = jest.fn();
      
      await authenticate(req, mockRes(), next);
      
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });
  });

  describe('optionalAuth', () => {
    it('deve prosseguir sem erro quando não há token', async () => {
      const req = { headers: {} };
      const next = jest.fn();
      await optionalAuth(req, mockRes(), next);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeUndefined();
    });

    it('deve popular req.user quando token válido presente', async () => {
      const token = jwt.sign({ id: 'user-1', perfil: 'admin', nome: 'Test' }, TEST_SECRET, { expiresIn: '1h' });
      const req = { headers: { authorization: `Bearer ${token}` } };
      const next = jest.fn();
      
      await optionalAuth(req, mockRes(), next);
      
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe('user-1');
    });

    it('deve prosseguir sem erro quando token é inválido', async () => {
      const req = { headers: { authorization: 'Bearer invalid_token' } };
      const next = jest.fn();
      await optionalAuth(req, mockRes(), next);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeUndefined();
    });

    it('não deve popular req.user quando token está na blacklist', async () => {
      const token = jwt.sign({ id: 'user-1', perfil: 'admin' }, TEST_SECRET, { expiresIn: '1h' });
      await redis.setex(`bl:${hashToken(token)}`, 3600, '1');
      
      const req = { headers: { authorization: `Bearer ${token}` } };
      const next = jest.fn();
      
      await optionalAuth(req, mockRes(), next);
      
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeUndefined();
    });
  });
});
