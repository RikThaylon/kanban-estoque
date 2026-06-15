const { TRANSICOES_PEDIDO } = require('./pedido.workflow');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FAIXAS_GRAFO = ['VERDE', 'AMARELO', 'VERMELHO', 'SEM_DADOS'];
const STATUS_PEDIDO_GRAFO = Object.keys(TRANSICOES_PEDIDO);
const LIMITE_GRAFO_PADRAO = 120;
const LIMITE_GRAFO_MIN = 20;
const LIMITE_GRAFO_MAX = 200;
const LIMITE_PEDIDOS_GRAFO_PADRAO = 80;

function clampLimit(value, fallback = LIMITE_GRAFO_PADRAO) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(LIMITE_GRAFO_MAX, Math.max(LIMITE_GRAFO_MIN, parsed));
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function addNode(nodes, node) {
  if (!node?.id || nodes.has(node.id)) return;
  nodes.set(node.id, {
    metrics: {},
    ...node,
  });
}

function addEdge(edges, edge) {
  if (!edge?.source || !edge?.target || edges.has(edge.id)) return;
  edges.set(edge.id, edge);
}

function buildOptions(values, fields) {
  const map = new Map();
  values.forEach((row) => {
    const id = row[fields.id];
    if (!id || map.has(id)) return;
    map.set(id, {
      id,
      label: row[fields.label] || row[fields.codigo] || id,
      subtitle: row[fields.subtitle] || row[fields.codigo] || null,
    });
  });
  return Array.from(map.values()).sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

function normalizarFiltrosGrafo(query = {}) {
  return {
    produto_id: query.produto_id || null,
    maquina_id: query.maquina_id || null,
    departamento_id: query.departamento_id || null,
    supervisor_id: query.supervisor_id || null,
    fornecedor_id: query.fornecedor_id || null,
    faixa: query.faixa || null,
    status_pedido: query.status_pedido || null,
    estoque: query.estoque || null,
    busca: query.busca ? String(query.busca).trim() : '',
    data_inicio: query.data_inicio || null,
    data_fim: query.data_fim || null,
    pedidos_limit: query.pedidos_limit,
  };
}

module.exports = {
  UUID_REGEX,
  FAIXAS_GRAFO,
  STATUS_PEDIDO_GRAFO,
  LIMITE_GRAFO_PADRAO,
  LIMITE_GRAFO_MIN,
  LIMITE_GRAFO_MAX,
  LIMITE_PEDIDOS_GRAFO_PADRAO,
  clampLimit,
  toNumber,
  addNode,
  addEdge,
  buildOptions,
  normalizarFiltrosGrafo,
};
