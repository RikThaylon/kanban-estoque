/**
 * Testes de integração para rotas gerais (health, 404, dashboard, alertas)
 * @module tests/integration/general.routes.test
 */
require('../setup');

jest.mock('../../src/config/database', () => {
  const mq = jest.fn();
  return { query: mq, getClient: jest.fn().mockResolvedValue({query:jest.fn(),release:jest.fn()}), pool:{end:jest.fn()} };
});
jest.mock('../../src/config/redis', () => {
  const s = new Map();
  return { redis: { isStub:true, async get(k){const i=s.get(k);if(!i)return null;if(i.exp&&i.exp<Date.now()){s.delete(k);return null}return i.value}, async setex(k,sec,v){s.set(k,{value:v,exp:Date.now()+sec*1000});return'OK'}, async set(k,v){s.set(k,{value:v,exp:null});return'OK'}, async del(k){return s.delete(k)?1:0}, _store:s, on(){},connect(){},quit(){} }, connectRedis:jest.fn() };
});
jest.mock('../../src/utils/logger', () => ({ error:jest.fn(),warn:jest.fn(),info:jest.fn(),http:jest.fn(),debug:jest.fn() }));

const request = require('supertest');
const app = require('../../src/app');
const { query } = require('../../src/config/database');
const { authHeader } = require('../helpers/auth');

describe('General Routes', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('GET /health', () => {
    it('deve retornar status ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('404 Handler', () => {
    it('deve retornar 404 para rota inexistente', async () => {
      const res = await request(app).get('/api/v1/inexistente');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    });
    it('deve incluir método e path na mensagem', async () => {
      const res = await request(app).post('/rota/fantasma');
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('POST');
    });
  });

  describe('Dashboard Routes', () => {
    it('GET /api/v1/dashboard/resumo deve retornar KPIs', async () => {
      // Mock de múltiplas queries do dashboard
      query.mockResolvedValue({rows:[{count:'0',total:'0',valor:0}]});
      const res = await request(app).get('/api/v1/dashboard/resumo').set('Authorization',authHeader('admin'));
      expect(res.status).toBe(200);
    });
  });

  describe('Alertas Routes', () => {
    it('GET /api/v1/alertas deve listar alertas', async () => {
      query.mockResolvedValueOnce({rows:[{count:'2'}]})
        .mockResolvedValueOnce({rows:[{id:'a1',tipo:'FAIXA_AMARELO',titulo:'Alerta teste'}]});
      const res = await request(app).get('/api/v1/alertas').set('Authorization',authHeader('admin'));
      expect(res.status).toBe(200);
    });
  });

  describe('Fornecedores Routes', () => {
    it('GET /api/v1/fornecedores deve listar', async () => {
      query.mockResolvedValueOnce({rows:[{count:'1'}]})
        .mockResolvedValueOnce({rows:[{id:'f1',nome:'Fornecedor A'}]});
      const res = await request(app).get('/api/v1/fornecedores').set('Authorization',authHeader('admin'));
      expect(res.status).toBe(200);
    });
  });

  describe('Departamentos Routes', () => {
    it('GET /api/v1/departamentos deve listar', async () => {
      query.mockResolvedValue({rows:[{id:'d1',nome:'Produção',codigo:'PROD'}]});
      const res = await request(app).get('/api/v1/departamentos').set('Authorization',authHeader('admin'));
      expect(res.status).toBe(200);
    });
  });

  describe('Maquinas Routes', () => {
    it('GET /api/v1/maquinas deve listar', async () => {
      query.mockResolvedValue({rows:[{id:'m1',nome:'Torno CNC',codigo:'MAQ-001'}]});
      const res = await request(app).get('/api/v1/maquinas').set('Authorization',authHeader('admin'));
      expect(res.status).toBe(200);
    });
  });
});
