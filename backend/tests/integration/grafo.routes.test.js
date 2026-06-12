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

describe('Grafo Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ rows: [] });
  });

  it('GET /api/v1/grafo/relacionamentos deve montar nos e arestas do relacionamento operacional', async () => {
    const produtoId = '11111111-1111-4111-b111-111111111111';
    const maquinaId = '22222222-2222-4222-b222-222222222222';
    const departamentoId = '33333333-3333-4333-b333-333333333333';
    const supervisorId = '44444444-4444-4444-b444-444444444444';
    const fornecedorId = '55555555-5555-4555-b555-555555555555';
    const pedidoId = '66666666-6666-4666-b666-666666666666';

    query
      .mockResolvedValueOnce({
        rows: [{
          id: produtoId,
          codigo: 'P-001',
          nome: 'Filtro hidraulico',
          unidade: 'UN',
          estoque_atual: '4',
          faixa_atual: 'VERMELHO',
          ponto_reposicao: '10',
          estoque_seguranca: '5',
          eoq: '30',
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          produto_id: produtoId,
          consumo_estimado_diario: '1.5',
          maquina_id: maquinaId,
          maquina_codigo: 'M-01',
          maquina_nome: 'Prensa',
          departamento_id: departamentoId,
          departamento_codigo: 'PROD',
          departamento_nome: 'Producao',
          supervisor_id: supervisorId,
          supervisor_nome: 'Supervisor Teste',
          supervisor_username: 'supervisor',
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          produto_id: produtoId,
          prioridade: 1,
          preco_acordado: '42.90',
          lead_time_nominal_dias: 7,
          fornecedor_id: fornecedorId,
          fornecedor_nome: 'Fornecedor A',
          cidade: 'Manaus',
          estado: 'AM',
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: pedidoId,
          numero: 'PC-202606-0001',
          produto_id: produtoId,
          fornecedor_id: fornecedorId,
          maquina_id: maquinaId,
          departamento_id: departamentoId,
          quantidade_pedida: '30',
          quantidade_recebida: '0',
          custo_total: '1287.00',
          status: 'AGUARDANDO_APROVACAO',
        }],
      });

    const res = await request(app)
      .get('/api/v1/grafo/relacionamentos')
      .set('Authorization', authHeader('admin'));

    expect(res.status).toBe(200);
    expect(res.body.stats).toEqual(expect.objectContaining({
      produtos: 1,
      maquinas: 1,
      departamentos: 1,
      supervisores: 1,
      fornecedores: 1,
      pedidos: 1,
    }));
    expect(res.body.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: `produto:${produtoId}`, type: 'produto', status: 'VERMELHO' }),
      expect.objectContaining({ id: `pedido:${pedidoId}`, type: 'pedido', status: 'AGUARDANDO_APROVACAO' }),
    ]));
    expect(res.body.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: `produto:${produtoId}`, target: `maquina:${maquinaId}`, type: 'consumo' }),
      expect.objectContaining({ source: `pedido:${pedidoId}`, target: `produto:${produtoId}`, type: 'compra' }),
    ]));
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM produtos p'), expect.any(Array));
  });

  it('GET /api/v1/grafo/relacionamentos deve validar filtros', async () => {
    const res = await request(app)
      .get('/api/v1/grafo/relacionamentos?faixa=AZUL')
      .set('Authorization', authHeader('admin'));

    expect(res.status).toBe(400);
  });
});
