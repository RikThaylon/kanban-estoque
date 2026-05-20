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

describe('Configuracoes Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ rows: [] });
  });

  it('PATCH /api/v1/configuracoes/kanban deve salvar nivel e ciclos', async () => {
    const res = await request(app)
      .patch('/api/v1/configuracoes/kanban')
      .set('Authorization', authHeader('admin'))
      .send({ nivel_servico_padrao: 95, ciclos_estimativa_inicial: 10 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ nivel_servico_padrao: 95, ciclos_estimativa_inicial: 10 });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('configuracoes_sistema'), expect.arrayContaining(['kanban.nivel_servico_padrao']));
    const sql = query.mock.calls.find(([text]) => String(text).includes('INSERT INTO configuracoes_sistema'))[0];
    expect(sql).not.toContain('atualizado_por');
    expect(sql).not.toContain('categoria');
  });

  it('PATCH /api/v1/configuracoes/pedidos deve salvar sem depender de colunas extras', async () => {
    const res = await request(app)
      .patch('/api/v1/configuracoes/pedidos')
      .set('Authorization', authHeader('admin'))
      .send({ limite_supervisor: 5000, limite_gerente: 50000 });

    expect(res.status).toBe(200);
    expect(res.body.limite_supervisor).toBe(5000);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO configuracoes_sistema'), ['pedidos.limite_supervisor', '5000']);
  });

  it('PATCH /api/v1/configuracoes/permissoes deve salvar matriz de permissoes', async () => {
    const res = await request(app)
      .patch('/api/v1/configuracoes/permissoes')
      .set('Authorization', authHeader('admin'))
      .send({
        cadastrar_item: ['comprador'],
        editar_curva_abc: ['eng_producao'],
        paginas: { dashboard: ['comprador'] },
      });

    expect(res.status).toBe(200);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO configuracoes_sistema'), ['permissoes.cadastrar_item', 'comprador']);
  });
});
