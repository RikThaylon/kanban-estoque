/**
 * Testes de integração para rotas de movimentações
 * @module tests/integration/movimentacoes.routes.test
 */
require('../setup');

jest.mock('../../src/config/database', () => {
  const mq = jest.fn(); const mc = { query: jest.fn(), release: jest.fn() };
  return { query: mq, getClient: jest.fn().mockResolvedValue(mc), pool: { end: jest.fn() }, _mockClient: mc };
});
jest.mock('../../src/config/redis', () => {
  const s = new Map();
  return { redis: { isStub: true, async get(k){const i=s.get(k);if(!i)return null;if(i.exp&&i.exp<Date.now()){s.delete(k);return null}return i.value}, async setex(k,sec,v){s.set(k,{value:v,exp:Date.now()+sec*1000});return'OK'}, async set(k,v){s.set(k,{value:v,exp:null});return'OK'}, async del(k){return s.delete(k)?1:0}, _store:s, on(){},connect(){},quit(){} }, connectRedis:jest.fn() };
});
jest.mock('../../src/utils/logger', () => ({ error:jest.fn(),warn:jest.fn(),info:jest.fn(),http:jest.fn(),debug:jest.fn() }));
jest.mock('../../src/services/kanban.calc', () => ({ recalcularKanban: jest.fn().mockResolvedValue({}) }));

const request = require('supertest');
const app = require('../../src/app');
const { query, _mockClient } = require('../../src/config/database');
const { USERS, authHeader } = require('../helpers/auth');

describe('Movimentacoes Routes', () => {
  beforeEach(() => { jest.clearAllMocks(); _mockClient.query.mockReset(); query.mockResolvedValue({rows:[]}); app.set('io',{emit:jest.fn()}); });

  describe('GET /api/v1/movimentacoes', () => {
    it('deve listar com paginação', async () => {
      query.mockResolvedValueOnce({rows:[{count:'5'}]}).mockResolvedValueOnce({rows:[{id:'1'},{id:'2'}]});
      const res = await request(app).get('/api/v1/movimentacoes').set('Authorization',authHeader('admin'));
      expect(res.status).toBe(200); expect(res.body.total).toBe(5);
    });
    it('deve filtrar por tipo', async () => {
      query.mockResolvedValueOnce({rows:[{count:'0'}]}).mockResolvedValueOnce({rows:[]});
      const res = await request(app).get('/api/v1/movimentacoes?tipo=ENTRADA').set('Authorization',authHeader('admin'));
      expect(res.status).toBe(200);
    });
    it('deve retornar 401 sem auth', async () => {
      expect((await request(app).get('/api/v1/movimentacoes')).status).toBe(401);
    });
  });

  describe('POST /api/v1/movimentacoes', () => {
    const body = { produto_id:'11111111-1111-4111-b111-111111111111', tipo:'ENTRADA', quantidade:10, turno:'TURNO_A' };

    it('deve criar ENTRADA direta', async () => {
      _mockClient.query.mockResolvedValueOnce({}).mockResolvedValueOnce({rows:[{estoque_atual:100}]})
        .mockResolvedValueOnce({rows:[{id:'m1',status:'EXECUTADO'}]}).mockResolvedValueOnce({}).mockResolvedValueOnce({});
      const res = await request(app).post('/api/v1/movimentacoes').set('Authorization',authHeader('admin')).send(body);
      expect(res.status).toBe(201);
      expect(_mockClient.query).toHaveBeenCalledWith(expect.stringContaining('turno'), expect.arrayContaining(['TURNO_A']));
    });
    it('deve criar AJUSTE como PENDENTE', async () => {
      _mockClient.query.mockResolvedValueOnce({}).mockResolvedValueOnce({rows:[{estoque_atual:100}]})
        .mockResolvedValueOnce({rows:[{id:'m2',status:'PENDENTE',aviso:'Pendente'}]}).mockResolvedValueOnce({});
      const res = await request(app).post('/api/v1/movimentacoes').set('Authorization',authHeader('admin'))
        .send({...body,tipo:'AJUSTE_POSITIVO'});
      expect(res.status).toBe(201);
    });
    it('deve rejeitar estoque insuficiente SAIDA', async () => {
      _mockClient.query.mockResolvedValueOnce({}).mockResolvedValueOnce({rows:[{estoque_atual:5}]}).mockResolvedValue({});
      const res = await request(app).post('/api/v1/movimentacoes').set('Authorization',authHeader('admin'))
        .send({...body,tipo:'SAIDA',quantidade:100});
      expect(res.status).toBe(400);
    });
    it('deve rejeitar produto inexistente', async () => {
      _mockClient.query.mockResolvedValueOnce({}).mockResolvedValueOnce({rows:[]}).mockResolvedValue({});
      const res = await request(app).post('/api/v1/movimentacoes').set('Authorization',authHeader('admin')).send(body);
      expect(res.status).toBe(404);
    });
    it('deve validar UUID', async () => {
      const res = await request(app).post('/api/v1/movimentacoes').set('Authorization',authHeader('admin'))
        .send({...body,produto_id:'bad'});
      expect(res.status).toBe(400);
    });
    it('deve validar quantidade > 0', async () => {
      const res = await request(app).post('/api/v1/movimentacoes').set('Authorization',authHeader('admin'))
        .send({...body,quantidade:-5});
      expect(res.status).toBe(400);
    });
    it('deve bloquear TRANSFERENCIA em novos lancamentos', async () => {
      const res = await request(app).post('/api/v1/movimentacoes').set('Authorization',authHeader('admin'))
        .send({...body,tipo:'TRANSFERENCIA'});
      expect(res.status).toBe(400);
    });
    it('deve negar eng_processos', async () => {
      const res = await request(app).post('/api/v1/movimentacoes').set('Authorization',authHeader('eng_processos')).send(body);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/movimentacoes/:id/aprovar', () => {
    const mid = '22222222-2222-4222-b222-222222222222';
    it('deve aprovar PENDENTE', async () => {
      _mockClient.query.mockResolvedValueOnce({}).mockResolvedValueOnce({rows:[{id:mid,status:'PENDENTE',tipo:'AJUSTE_POSITIVO',quantidade:10,produto_id:'p1',criado_por:USERS.comprador.id}]})
        .mockResolvedValueOnce({rows:[{estoque_atual:50}]}).mockResolvedValueOnce({}).mockResolvedValueOnce({}).mockResolvedValueOnce({});
      const res = await request(app).post(`/api/v1/movimentacoes/${mid}/aprovar`).set('Authorization',authHeader('supervisor_turno'));
      expect(res.status).toBe(200);
    });
    it('deve bloquear auto-aprovação (não admin)', async () => {
      _mockClient.query.mockResolvedValueOnce({}).mockResolvedValueOnce({rows:[{id:mid,status:'PENDENTE',criado_por:USERS.supervisor_turno.id}]}).mockResolvedValue({});
      const res = await request(app).post(`/api/v1/movimentacoes/${mid}/aprovar`).set('Authorization',authHeader('supervisor_turno'));
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/movimentacoes/:id/rejeitar', () => {
    const mid = '33333333-3333-4333-b333-333333333333';
    it('deve rejeitar com motivo', async () => {
      query.mockResolvedValueOnce({rows:[{status:'PENDENTE',criado_por:'x'}]}).mockResolvedValueOnce({});
      const res = await request(app).post(`/api/v1/movimentacoes/${mid}/rejeitar`).set('Authorization',authHeader('supervisor_turno'))
        .send({motivo:'Quantidade incorreta, revisar'});
      expect(res.status).toBe(200);
    });
    it('deve exigir motivo >= 5 chars', async () => {
      const res = await request(app).post(`/api/v1/movimentacoes/${mid}/rejeitar`).set('Authorization',authHeader('supervisor_turno'))
        .send({motivo:'ab'});
      expect(res.status).toBe(400);
    });
  });
});
