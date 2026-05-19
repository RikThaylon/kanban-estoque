/**
 * Testes de integração para rotas de produtos
 * @module tests/integration/produtos.routes.test
 */
require('../setup');

jest.mock('../../src/config/database', () => {
  const mq = jest.fn(); const mc = { query: jest.fn(), release: jest.fn() };
  return { query: mq, getClient: jest.fn().mockResolvedValue(mc), pool: { end: jest.fn() }, _mockClient: mc };
});
jest.mock('../../src/config/redis', () => {
  const s = new Map();
  return { redis: { isStub:true, async get(k){const i=s.get(k);if(!i)return null;if(i.exp&&i.exp<Date.now()){s.delete(k);return null}return i.value}, async setex(k,sec,v){s.set(k,{value:v,exp:Date.now()+sec*1000});return'OK'}, async set(k,v){s.set(k,{value:v,exp:null});return'OK'}, async del(k){return s.delete(k)?1:0}, _store:s, on(){},connect(){},quit(){} }, connectRedis:jest.fn() };
});
jest.mock('../../src/utils/logger', () => ({ error:jest.fn(),warn:jest.fn(),info:jest.fn(),http:jest.fn(),debug:jest.fn() }));
jest.mock('../../src/services/kanban.calc', () => ({ recalcularKanban: jest.fn().mockResolvedValue({}) }));

const request = require('supertest');
const app = require('../../src/app');
const { query } = require('../../src/config/database');
const { authHeader } = require('../helpers/auth');

describe('Produtos Routes', () => {
  beforeEach(() => { jest.clearAllMocks(); query.mockResolvedValue({rows:[]}); });

  describe('GET /api/v1/produtos', () => {
    it('deve listar produtos com paginação e resumo', async () => {
      query.mockResolvedValueOnce({rows:[{count:'3'}]})
        .mockResolvedValueOnce({rows:[{id:'p1',nome:'VH-200',faixa_atual:'VERDE'}]})
        .mockResolvedValueOnce({rows:[{faixa_atual:'VERDE',count:'2'},{faixa_atual:'AMARELO',count:'1'}]});
      const res = await request(app).get('/api/v1/produtos').set('Authorization',authHeader('admin'));
      expect(res.status).toBe(200); expect(res.body.resumo).toBeDefined();
    });
    it('deve filtrar por faixa', async () => {
      query.mockResolvedValueOnce({rows:[{count:'1'}]}).mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[]});
      const res = await request(app).get('/api/v1/produtos?faixa=VERMELHO').set('Authorization',authHeader('admin'));
      expect(res.status).toBe(200);
    });
    it('deve buscar por nome/código', async () => {
      query.mockResolvedValueOnce({rows:[{count:'1'}]}).mockResolvedValueOnce({rows:[{id:'p1'}]}).mockResolvedValueOnce({rows:[]});
      const res = await request(app).get('/api/v1/produtos?busca=VH').set('Authorization',authHeader('admin'));
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/produtos', () => {
    const body = {codigo:'TST-001',nome:'Produto Teste',unidade:'UN',custo_unitario:45};
    it('admin deve criar produto', async () => {
      query.mockResolvedValueOnce({rows:[{id:'p1',codigo:'TST-001',nome:'Produto Teste'}]})
        .mockResolvedValueOnce({rows:[]}); // INSERT kanban_parametros
      const res = await request(app).post('/api/v1/produtos').set('Authorization',authHeader('admin')).send(body);
      expect(res.status).toBe(201);
    });
    it('comprador deve criar produto por permissao padrao', async () => {
      query.mockResolvedValueOnce({rows:[]})
        .mockResolvedValueOnce({rows:[]})
        .mockResolvedValueOnce({rows:[{id:'p1',codigo:'TST-001',nome:'Produto Teste'}]})
        .mockResolvedValueOnce({rows:[]});
      const res = await request(app).post('/api/v1/produtos').set('Authorization',authHeader('comprador')).send(body);
      expect(res.status).toBe(201);
    });
    it('deve validar campos obrigatórios', async () => {
      const res = await request(app).post('/api/v1/produtos').set('Authorization',authHeader('admin')).send({});
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/produtos/:id', () => {
    it('deve retornar produto com fornecedores e movimentações', async () => {
      query.mockResolvedValueOnce({rows:[{id:'p1',nome:'VH-200'}]})
        .mockResolvedValueOnce({rows:[{fornecedor_id:'f1'}]})
        .mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[]});
      const res = await request(app).get('/api/v1/produtos/p1').set('Authorization',authHeader('admin'));
      expect(res.status).toBe(200); expect(res.body.fornecedores).toBeDefined();
    });
    it('deve retornar 404 para produto inexistente', async () => {
      query.mockResolvedValueOnce({rows:[]});
      const res = await request(app).get('/api/v1/produtos/inexistente').set('Authorization',authHeader('admin'));
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/produtos/:id', () => {
    it('deve atualizar campos permitidos', async () => {
      query.mockResolvedValueOnce({rows:[{id:'p1',nome:'Atualizado'}]});
      const res = await request(app).patch('/api/v1/produtos/p1').set('Authorization',authHeader('admin'))
        .send({nome:'Atualizado',custo_unitario:50});
      expect(res.status).toBe(200);
    });
    it('deve rejeitar body vazio', async () => {
      const res = await request(app).patch('/api/v1/produtos/p1').set('Authorization',authHeader('admin')).send({});
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/v1/produtos/:id', () => {
    it('admin deve desativar (soft delete)', async () => {
      query.mockResolvedValueOnce({rows:[{id:'p1'}]});
      const res = await request(app).delete('/api/v1/produtos/p1').set('Authorization',authHeader('admin'));
      expect(res.status).toBe(200);
    });
    it('não-admin não pode deletar', async () => {
      const res = await request(app).delete('/api/v1/produtos/p1').set('Authorization',authHeader('supervisor_turno'));
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/produtos/:id/rastreamento-calculo', () => {
    it('deve retornar rastreamento com conferência simples', async () => {
      query.mockResolvedValueOnce({rows:[{custo_unitario:45,custo_pedido:150,taxa_carregamento:0.2,nivel_servico:95,estoque_atual:100}]})
        .mockResolvedValueOnce({rows:Array(12).fill({semana:'2025-01-01',consumo:24.5})})
        .mockResolvedValueOnce({rows:[{lead_time_real_dias:7},{lead_time_real_dias:8}]})
        .mockResolvedValueOnce({rows:[]});
      const res = await request(app).get('/api/v1/produtos/p1/rastreamento-calculo').set('Authorization',authHeader('admin'));
      expect(res.status).toBe(200);
      expect(res.body.conferencia_simples).toBeDefined();
      expect(res.body.holt_inputs).toBeDefined();
    });
  });
});
