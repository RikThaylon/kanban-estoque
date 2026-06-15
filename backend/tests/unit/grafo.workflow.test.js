const {
  UUID_REGEX,
  FAIXAS_GRAFO,
  STATUS_PEDIDO_GRAFO,
  LIMITE_GRAFO_MIN,
  LIMITE_GRAFO_MAX,
  LIMITE_PEDIDOS_GRAFO_PADRAO,
  clampLimit,
  toNumber,
  addNode,
  addEdge,
  buildOptions,
  normalizarFiltrosGrafo,
} = require('../../src/services/grafo.workflow');

describe('grafo.workflow', () => {
  it('centraliza dominios aceitos nos filtros', () => {
    expect(UUID_REGEX.test('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(FAIXAS_GRAFO).toEqual(['VERDE', 'AMARELO', 'VERMELHO', 'SEM_DADOS']);
    expect(STATUS_PEDIDO_GRAFO).toEqual(expect.arrayContaining(['AGUARDANDO_APROVACAO', 'CONCLUIDO', 'REJEITADO']));
  });

  it('limita tamanho do grafo entre minimo e maximo', () => {
    expect(clampLimit('1')).toBe(LIMITE_GRAFO_MIN);
    expect(clampLimit('999')).toBe(LIMITE_GRAFO_MAX);
    expect(clampLimit(undefined, LIMITE_PEDIDOS_GRAFO_PADRAO)).toBe(LIMITE_PEDIDOS_GRAFO_PADRAO);
  });

  it('converte numeros opcionais', () => {
    expect(toNumber('12.5')).toBe(12.5);
    expect(toNumber('')).toBeNull();
    expect(toNumber('abc')).toBeNull();
  });

  it('deduplica nos e arestas', () => {
    const nodes = new Map();
    const edges = new Map();

    addNode(nodes, { id: 'produto:1', type: 'produto', label: 'P1' });
    addNode(nodes, { id: 'produto:1', type: 'produto', label: 'P1 duplicado' });
    addEdge(edges, { id: 'a->b', source: 'a', target: 'b', type: 'teste' });
    addEdge(edges, { id: 'a->b', source: 'a', target: 'b', type: 'duplicado' });

    expect(Array.from(nodes.values())).toEqual([{ id: 'produto:1', type: 'produto', label: 'P1', metrics: {} }]);
    expect(Array.from(edges.values())).toEqual([{ id: 'a->b', source: 'a', target: 'b', type: 'teste' }]);
  });

  it('gera opcoes ordenadas e sem duplicidade', () => {
    const opcoes = buildOptions([
      { maquina_id: 'm2', maquina_codigo: 'M2', maquina_nome: 'Maquina 2' },
      { maquina_id: 'm1', maquina_codigo: 'M1', maquina_nome: 'Maquina 1' },
      { maquina_id: 'm1', maquina_codigo: 'M1 duplicada' },
      { maquina_id: null },
    ], { id: 'maquina_id', label: 'maquina_codigo', subtitle: 'maquina_nome' });

    expect(opcoes).toEqual([
      { id: 'm1', label: 'M1', subtitle: 'Maquina 1' },
      { id: 'm2', label: 'M2', subtitle: 'Maquina 2' },
    ]);
  });

  it('normaliza filtros de query', () => {
    expect(normalizarFiltrosGrafo({
      produto_id: 'p1',
      busca: '  rolamento  ',
      estoque: 'critico',
      pedidos_limit: '30',
    })).toMatchObject({
      produto_id: 'p1',
      busca: 'rolamento',
      estoque: 'critico',
      pedidos_limit: '30',
      maquina_id: null,
      data_inicio: null,
    });
  });
});
