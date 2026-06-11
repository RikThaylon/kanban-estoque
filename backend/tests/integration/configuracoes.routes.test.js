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
const { salvarConfiguracoes } = require('../../src/services/configuracoes.service');

describe('Configuracoes Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ rows: [], rowCount: 1 });
  });

  it('PATCH /api/v1/configuracoes/kanban deve salvar nivel, ciclos e custo para manter', async () => {
    const res = await request(app)
      .patch('/api/v1/configuracoes/kanban')
      .set('Authorization', authHeader('admin'))
      .send({ nivel_servico_padrao: 95, ciclos_estimativa_inicial: 10, taxa_carregamento_padrao: 0.25 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ nivel_servico_padrao: 95, ciclos_estimativa_inicial: 10, taxa_carregamento_padrao: 0.25 });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('configuracoes_sistema'), expect.arrayContaining(['kanban.nivel_servico_padrao']));
    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE configuracoes_sistema'), ['kanban.taxa_carregamento_padrao', '0.25']);
    const sql = query.mock.calls.find(([text]) => String(text).includes('UPDATE configuracoes_sistema'))[0];
    expect(sql).not.toContain('atualizado_por');
    expect(sql).not.toContain('categoria');
    expect(sql).not.toContain('ON CONFLICT');
  });

  it('PATCH /api/v1/configuracoes/pedidos deve salvar sem depender de colunas extras', async () => {
    for (let i = 0; i < 8; i += 1) {
      query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    }
    query
      .mockResolvedValueOnce({ rows: [{ valor: 'facilitador' }] })
      .mockResolvedValueOnce({ rows: [{ valor: 'supervisor_turno,gerente_operacoes' }] })
      .mockResolvedValueOnce({ rows: [{ valor: 'gerente_operacoes' }] })
      .mockResolvedValueOnce({ rows: [{ valor: 'plant_manager' }] })
      .mockResolvedValueOnce({ rows: [{ valor: 'comprador' }] })
      .mockResolvedValueOnce({ rows: [{ valor: 'comprador,facilitador' }] });

    const res = await request(app)
      .patch('/api/v1/configuracoes/pedidos')
      .set('Authorization', authHeader('admin'))
      .send({
        limite_supervisor: 5000,
        limite_gerente: 50000,
        solicitantes: ['facilitador'],
        aprovadores_nivel_1: ['supervisor_turno', 'gerente_operacoes'],
        aprovadores_nivel_2: ['gerente_operacoes'],
        aprovadores_nivel_3: ['plant_manager'],
        compradores: ['comprador'],
        recebedores: ['comprador', 'facilitador'],
      });

    expect(res.status).toBe(200);
    expect(res.body.limite_supervisor).toBe(5000);
    expect(res.body.solicitantes).toEqual(['facilitador']);
    expect(res.body.compradores).toEqual(['comprador']);
    expect(res.body.recebedores).toEqual(['comprador', 'facilitador']);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE configuracoes_sistema'), ['pedidos.limite_supervisor', '5000']);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE configuracoes_sistema'), ['pedidos.solicitantes', 'facilitador']);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE configuracoes_sistema'), ['pedidos.aprovadores_nivel_1', 'supervisor_turno,gerente_operacoes']);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE configuracoes_sistema'), ['pedidos.compradores', 'comprador']);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE configuracoes_sistema'), ['pedidos.recebedores', 'comprador,facilitador']);
  });

  it('PATCH /api/v1/configuracoes/pedidos deve ser restrito ao admin', async () => {
    const res = await request(app)
      .patch('/api/v1/configuracoes/pedidos')
      .set('Authorization', authHeader('comprador'))
      .send({
        limite_supervisor: 5000,
        limite_gerente: 50000,
        solicitantes: ['facilitador'],
      });

    expect(res.status).toBe(403);
  });

  it('PATCH /api/v1/configuracoes/pedidos nao permite comprador como aprovador interno', async () => {
    const res = await request(app)
      .patch('/api/v1/configuracoes/pedidos')
      .set('Authorization', authHeader('admin'))
      .send({
        limite_supervisor: 5000,
        limite_gerente: 50000,
        aprovadores_nivel_1: ['comprador'],
      });

    expect(res.status).toBe(400);
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
    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE configuracoes_sistema'), ['permissoes.cadastrar_item', 'comprador']);
  });

  it('PATCH /api/v1/configuracoes/turnos deve salvar turnos operacionais', async () => {
    const turnos = [
      { id: '1T', nome: '1T', inicio: '06:00', fim: '14:00' },
      { id: '2T', nome: '2T', inicio: '14:01', fim: '22:00' },
      { id: '3T', nome: '3T', inicio: '22:01', fim: '05:59' },
    ];

    const res = await request(app)
      .patch('/api/v1/configuracoes/turnos')
      .set('Authorization', authHeader('admin'))
      .send({ turnos });

    expect(res.status).toBe(200);
    expect(res.body.turnos).toEqual(turnos);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE configuracoes_sistema'),
      ['turnos.lista', JSON.stringify(turnos)]
    );
  });

  it('salvarConfiguracoes deve criar chave nova sem exigir constraint ON CONFLICT', async () => {
    query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await salvarConfiguracoes({ 'teste.chave': 123 }, 'user-1');

    expect(query).toHaveBeenNthCalledWith(
      1,
      'UPDATE configuracoes_sistema SET valor = $2 WHERE chave = $1',
      ['teste.chave', '123']
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      'INSERT INTO configuracoes_sistema (chave, valor) VALUES ($1, $2)',
      ['teste.chave', '123']
    );
    expect(query.mock.calls.map(([sql]) => sql).join('\n')).not.toContain('ON CONFLICT');
  });
});
