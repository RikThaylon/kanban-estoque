/**
 * Testes de integração para rotas de pedidos
 * @module tests/integration/pedidos.routes.test
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
const { query, _mockClient } = require('../../src/config/database');
const { USERS, authHeader } = require('../helpers/auth');

describe('Pedidos Routes', () => {
  beforeEach(() => { jest.clearAllMocks(); _mockClient.query.mockReset(); query.mockResolvedValue({rows:[]}); app.set('io',{emit:jest.fn()}); });

  describe('GET /api/v1/pedidos', () => {
    it('deve listar pedidos paginados', async () => {
      query.mockResolvedValueOnce({rows:[{count:'10'}]}).mockResolvedValueOnce({rows:[{id:'p1',numero:'PC-202605-0001'}]});
      const res = await request(app).get('/api/v1/pedidos').set('Authorization',authHeader('admin'));
      expect(res.status).toBe(200); expect(res.body.total).toBe(10);
    });
    it('deve filtrar por status', async () => {
      query.mockResolvedValueOnce({rows:[{count:'0'}]}).mockResolvedValueOnce({rows:[]});
      const res = await request(app).get('/api/v1/pedidos?status=APROVADO').set('Authorization',authHeader('admin'));
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/pedidos/sugestoes', () => {
    it('deve retornar sugestões de compra', async () => {
      query.mockResolvedValueOnce({rows:[{id:'p1',codigo:'VH-200',faixa_atual:'AMARELO',eoq:136}]});
      const res = await request(app).get('/api/v1/pedidos/sugestoes').set('Authorization',authHeader('admin'));
      expect(res.status).toBe(200); expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/v1/pedidos', () => {
    const body = {
      produto_id:'11111111-1111-4111-b111-111111111111',
      fornecedor_id:'22222222-2222-4222-b222-222222222222',
      quantidade_pedida:100, preco_unitario:45.00
    };

    it('admin deve criar como RASCUNHO', async () => {
      query.mockResolvedValueOnce({rows:[{numero:'PC-000'}]}) // gerarNumeroPedido
        .mockResolvedValueOnce({rows:[{faixa_atual:'AMARELO',ponto_reposicao:50}]}) // kanban_parametros
        .mockResolvedValueOnce({rows:[{estoque_atual:30}]}) // produto
        .mockResolvedValueOnce({rows:[{maquina_id:'maq-1',departamento_id:'dep-1',supervisor_id:'sup-1'}]}) // maquina_produto
        .mockResolvedValueOnce({rows:[]})
        .mockResolvedValueOnce({rows:[]})
        .mockResolvedValueOnce({rows:[{id:'ped-1',numero:'PC-202605-0001',status:'RASCUNHO'}]}); // INSERT
      const res = await request(app).post('/api/v1/pedidos').set('Authorization',authHeader('admin')).send(body);
      expect(res.status).toBe(201); expect(res.body.status).toBe('RASCUNHO');
    });

    it('comprador com custo < R$5000 deve criar AGUARDANDO_APROVACAO', async () => {
      query.mockResolvedValueOnce({rows:[{numero:'PC-000'}]})
        .mockResolvedValueOnce({rows:[{faixa_atual:'AMARELO',ponto_reposicao:50}]})
        .mockResolvedValueOnce({rows:[{estoque_atual:30}]})
        .mockResolvedValueOnce({rows:[{maquina_id:'maq-1',departamento_id:'dep-1',supervisor_id:'sup-1'}]})
        .mockResolvedValueOnce({rows:[]})
        .mockResolvedValueOnce({rows:[]})
        .mockResolvedValueOnce({rows:[{id:'ped-2',status:'AGUARDANDO_APROVACAO'}]});
      const res = await request(app).post('/api/v1/pedidos').set('Authorization',authHeader('comprador'))
        .send({...body,preco_unitario:10,quantidade_pedida:100}); // custo 1000
      expect(res.status).toBe(201); expect(res.body.status).toBe('AGUARDANDO_APROVACAO');
    });

    it('comprador com custo >= R$5000 deve criar AGUARDANDO_GERENTE', async () => {
      query.mockResolvedValueOnce({rows:[{numero:'PC-000'}]})
        .mockResolvedValueOnce({rows:[{faixa_atual:'AMARELO',ponto_reposicao:50}]})
        .mockResolvedValueOnce({rows:[{estoque_atual:30}]})
        .mockResolvedValueOnce({rows:[{maquina_id:'maq-1',departamento_id:'dep-1',supervisor_id:'sup-1'}]})
        .mockResolvedValueOnce({rows:[]})
        .mockResolvedValueOnce({rows:[]})
        .mockResolvedValueOnce({rows:[{id:'ped-3',status:'AGUARDANDO_GERENTE'}]});
      const res = await request(app).post('/api/v1/pedidos').set('Authorization',authHeader('comprador'))
        .send({...body,preco_unitario:100,quantidade_pedida:100}); // custo 10000
      expect(res.status).toBe(201); expect(res.body.status).toBe('AGUARDANDO_GERENTE');
    });

    it('facilitador deve criar solicitacao sem escolher fornecedor usando fornecedor principal do produto', async () => {
      query.mockResolvedValueOnce({rows:[{numero:'PC-000'}]})
        .mockResolvedValueOnce({rows:[{faixa_atual:'AMARELO',ponto_reposicao:50}]})
        .mockResolvedValueOnce({rows:[{estoque_atual:30,custo_unitario:12}]})
        .mockResolvedValueOnce({rows:[{fornecedor_id:'33333333-3333-4333-b333-333333333333',preco_acordado:10}]})
        .mockResolvedValueOnce({rows:[{maquina_id:'maq-1',departamento_id:'dep-1',supervisor_id:'sup-1'}]})
        .mockResolvedValueOnce({rows:[]})
        .mockResolvedValueOnce({rows:[]})
        .mockResolvedValueOnce({rows:[{id:'ped-4',status:'AGUARDANDO_APROVACAO'}]});

      const res = await request(app).post('/api/v1/pedidos').set('Authorization',authHeader('facilitador'))
        .send({produto_id:body.produto_id,quantidade_pedida:100});

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('AGUARDANDO_APROVACAO');
      expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO pedidos_compra'), expect.arrayContaining(['33333333-3333-4333-b333-333333333333', 10, 1000]));
    });

    it('deve validar produto_id UUID', async () => {
      const res = await request(app).post('/api/v1/pedidos').set('Authorization',authHeader('admin'))
        .send({...body,produto_id:'bad'});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/pedidos/:id/aprovar', () => {
    const pid = '44444444-4444-4444-b444-444444444444';
    it('sup turno deve aprovar AGUARDANDO_APROVACAO (custo baixo)', async () => {
      query.mockResolvedValueOnce({rows:[{id:pid,status:'AGUARDANDO_APROVACAO',custo_total:1000,criado_por:USERS.comprador.id}]})
        .mockResolvedValueOnce({rows:[]})
        .mockResolvedValueOnce({rows:[]})
        .mockResolvedValueOnce({rows:[{id:pid,numero:'PC-0001',status:'APROVADO'}]});
      const res = await request(app).post(`/api/v1/pedidos/${pid}/aprovar`).set('Authorization',authHeader('supervisor_turno'));
      expect(res.status).toBe(200);
    });

    it('sup turno deve escalar AGUARDANDO_APROVACAO >= R$5000 para AGUARDANDO_GERENTE', async () => {
      query.mockResolvedValueOnce({rows:[{id:pid,status:'AGUARDANDO_APROVACAO',custo_total:8000,criado_por:USERS.comprador.id}]})
        .mockResolvedValueOnce({rows:[]})
        .mockResolvedValueOnce({rows:[]})
        .mockResolvedValueOnce({rows:[{id:pid,numero:'PC-0001',status:'AGUARDANDO_GERENTE'}]});
      const res = await request(app).post(`/api/v1/pedidos/${pid}/aprovar`).set('Authorization',authHeader('supervisor_turno'));
      expect(res.status).toBe(200);
    });

    it('deve bloquear auto-aprovação (não admin)', async () => {
      query.mockResolvedValueOnce({rows:[{id:pid,status:'AGUARDANDO_APROVACAO',custo_total:100,criado_por:USERS.supervisor_turno.id}]});
      const res = await request(app).post(`/api/v1/pedidos/${pid}/aprovar`).set('Authorization',authHeader('supervisor_turno'));
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/pedidos/:id/rejeitar', () => {
    const pid = '55555555-5555-4555-b555-555555555555';
    it('deve rejeitar com motivo', async () => {
      query.mockResolvedValueOnce({rows:[{status:'AGUARDANDO_APROVACAO',criado_por:'x'}]})
        .mockResolvedValueOnce({rows:[{id:pid,numero:'PC-0001',status:'REJEITADO'}]});
      const res = await request(app).post(`/api/v1/pedidos/${pid}/rejeitar`).set('Authorization',authHeader('supervisor_turno'))
        .send({motivo:'Preço acima do mercado'});
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/pedidos/:id/receber', () => {
    const pid = '66666666-6666-4666-b666-666666666666';
    it('deve receber pedido e atualizar estoque', async () => {
      _mockClient.query.mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({rows:[{id:pid,status:'EMITIDO',produto_id:'p1',numero:'PC-001',quantidade_pedida:100,quantidade_recebida:0}]})
        .mockResolvedValueOnce({}) // UPDATE pedido
        .mockResolvedValueOnce({rows:[{estoque_atual:50}]}) // SELECT produto
        .mockResolvedValueOnce({}) // INSERT movimentacao
        .mockResolvedValueOnce({}) // UPDATE produto estoque
        .mockResolvedValueOnce({}); // COMMIT
      const res = await request(app).post(`/api/v1/pedidos/${pid}/receber`).set('Authorization',authHeader('admin'))
        .send({quantidade_recebida:100});
      expect(res.status).toBe(200); expect(res.body.status).toBe('RECEBIDO');
    });
  });
});
