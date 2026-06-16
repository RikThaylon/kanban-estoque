import React, { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Cog,
  ExternalLink,
  Filter,
  MousePointer2,
  Network,
  Package,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingCart,
  Truck,
  UserRound,
  Warehouse,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import api from '../services/api';
import { formatDate, formatMoney, formatNumber } from '../utils/formatters';

const EMPTY_FILTERS = {
  produto_id: '',
  busca: '',
  faixa: '',
  status_pedido: '',
  estoque: '',
  maquina_id: '',
  departamento_id: '',
  supervisor_id: '',
  fornecedor_id: '',
  data_inicio: '',
  data_fim: '',
};

const TYPE_ORDER = ['pedido', 'produto', 'estoque', 'maquina', 'departamento', 'supervisor', 'fornecedor'];
const NODE_W = 150;
const NODE_H = 58;

const TYPE_META = {
  produto: { label: 'Peças', icon: Package, color: '#005DFF', bg: '#F2F7FF', column: 1 },
  maquina: { label: 'Máquinas', icon: Cog, color: '#000000', bg: '#F7F9FC', column: 3 },
  departamento: { label: 'Departamentos', icon: Building2, color: '#3F4959', bg: '#FFFFFF', column: 4 },
  supervisor: { label: 'Supervisores', icon: UserRound, color: '#0088FF', bg: '#EAF6FF', column: 5 },
  fornecedor: { label: 'Fornecedores', icon: Truck, color: '#0044CC', bg: '#F2F7FF', column: 4 },
  estoque: { label: 'Estoque', icon: Warehouse, color: '#0088FF', bg: '#EAF6FF', column: 2 },
  pedido: { label: 'Pedidos', icon: ShoppingCart, color: '#00123D', bg: '#F7F9FC', column: 0 },
};

const STATUS_PEDIDO = [
  'AGUARDANDO_APROVACAO',
  'AGUARDANDO_GERENTE',
  'AGUARDANDO_DIRETORIA',
  'APROVADO',
  'AGUARDANDO_CHEGADA',
  'EM_TRANSITO',
  'RECEBIDO_PARCIAL',
  'CONCLUIDO',
  'CANCELADO',
  'REJEITADO',
];

function compactText(value, max = 18) {
  if (!value) return '-';
  const text = String(value);
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function labelStatus(status) {
  const labels = {
    VERDE: 'Verde',
    AMARELO: 'Amarelo',
    VERMELHO: 'Vermelho',
    SEM_DADOS: 'Sem dados',
    AGUARDANDO_APROVACAO: 'Aguardando supervisor',
    AGUARDANDO_GERENTE: 'Aguardando gerente',
    AGUARDANDO_DIRETORIA: 'Aguardando diretoria',
    AGUARDANDO_CHEGADA: 'Aguardando chegada',
    RECEBIDO_PARCIAL: 'Recebido parcial',
    CONCLUIDO: 'Concluído',
    APROVADO: 'Aprovado',
    CANCELADO: 'Cancelado',
    REJEITADO: 'Rejeitado',
    EM_TRANSITO: 'Em trânsito',
    PREFERENCIAL: 'Preferencial',
    ALTERNATIVO: 'Alternativo',
    RESPONSAVEL: 'Responsável',
    VINCULADA: 'Vinculada',
    SUPERVISIONADO: 'Supervisionado',
    PEDIDO: 'Pedido',
  };
  return labels[status] || String(status || '-').replace(/_/g, ' ').toLowerCase();
}

function statusColor(status) {
  if (status === 'VERMELHO' || status === 'REJEITADO' || status === 'CANCELADO') return '#CC2030';
  if (status === 'AMARELO' || status === 'AGUARDANDO_APROVACAO' || status === 'AGUARDANDO_GERENTE') return '#B86700';
  if (status === 'VERDE' || status === 'CONCLUIDO' || status === 'APROVADO') return '#0B7A4B';
  if (status === 'AGUARDANDO_CHEGADA' || status === 'EM_TRANSITO' || status === 'RECEBIDO_PARCIAL') return '#005DFF';
  return '#667085';
}

function buildParams(filtros) {
  return Object.fromEntries(
    Object.entries(filtros)
      .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])
      .filter(([, value]) => value !== '' && value !== null && value !== undefined)
  );
}

function buildLayout(nodes) {
  const columns = Array.from({ length: 6 }, () => []);
  nodes.forEach((node) => {
    const column = TYPE_META[node.type]?.column ?? 1;
    columns[column].push(node);
  });

  const orderRank = new Map(TYPE_ORDER.map((type, index) => [type, index]));
  columns.forEach((column) => {
    column.sort((a, b) => {
      const byType = (orderRank.get(a.type) ?? 99) - (orderRank.get(b.type) ?? 99);
      if (byType !== 0) return byType;
      return String(a.label).localeCompare(String(b.label));
    });
  });

  const maxColumn = Math.max(1, ...columns.map((column) => column.length));
  const canvasHeight = Math.max(720, 150 + maxColumn * 88);
  const positions = new Map();
  const columnX = [48, 238, 428, 618, 808, 998];

  columns.forEach((column, columnIndex) => {
    const blockHeight = Math.max(0, (column.length - 1) * 88);
    const startY = Math.max(54, (canvasHeight - blockHeight - NODE_H) / 2);
    column.forEach((node, index) => {
      positions.set(node.id, {
        x: columnX[columnIndex],
        y: startY + index * 88,
      });
    });
  });

  return { positions, canvasHeight, canvasWidth: 1196 };
}

function buildPath(source, target) {
  if (!source || !target) return '';
  const sx = source.x + NODE_W;
  const sy = source.y + NODE_H / 2;
  const tx = target.x;
  const ty = target.y + NODE_H / 2;
  const bend = Math.max(38, Math.abs(tx - sx) * 0.45);
  return `M ${sx} ${sy} C ${sx + bend} ${sy}, ${tx - bend} ${ty}, ${tx} ${ty}`;
}

function formatMetric(key, value) {
  if (value === null || value === undefined || value === '') return '-';
  if (key.includes('custo') || key.includes('preco')) return formatMoney(value);
  if (key.includes('data') || key === 'criado_em') return formatDate(value);
  if (typeof value === 'number') return formatNumber(value, Number.isInteger(value) ? 0 : 2);
  return String(value);
}

const StatCard = ({ label, value }) => (
  <div className="metric-card p-3">
    <p className="text-[11px] uppercase font-bold text-steel-500">{label}</p>
    <p className="mt-1 text-2xl font-black text-steel-900">{value ?? 0}</p>
  </div>
);

const EmptyGraph = () => (
  <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
    <div className="max-w-sm">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-white border border-steel-700/10">
        <Network className="h-6 w-6 text-steel-500" />
      </div>
      <h3 className="font-bold text-steel-900">Nenhuma relação encontrada</h3>
      <p className="mt-1 text-sm text-steel-500">Ajuste os filtros ou cadastre vínculos entre produto, máquina e fornecedor.</p>
    </div>
  </div>
);

const GrafoRelacionamentos = () => {
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [filtros, setFiltros] = useState(EMPTY_FILTERS);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState(null);
  const [tiposVisiveis, setTiposVisiveis] = useState(
    Object.fromEntries(TYPE_ORDER.map((type) => [type, true]))
  );
  const svgRef = useRef(null);

  const params = useMemo(() => buildParams(filtros), [filtros]);
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['grafo-relacionamentos', params],
    queryFn: async () => (await api.get('/grafo/relacionamentos', { params })).data,
    keepPreviousData: true,
  });

  const rawNodes = data?.nodes || [];
  const rawEdges = data?.edges || [];
  const visibleNodes = useMemo(
    () => rawNodes.filter((node) => tiposVisiveis[node.type] !== false),
    [rawNodes, tiposVisiveis]
  );
  const visibleIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(
    () => rawEdges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)),
    [rawEdges, visibleIds]
  );
  const layout = useMemo(() => buildLayout(visibleNodes), [visibleNodes]);

  const connectedIds = useMemo(() => {
    if (!selectedNodeId) return new Set();
    const ids = new Set([selectedNodeId]);
    visibleEdges.forEach((edge) => {
      if (edge.source === selectedNodeId || edge.target === selectedNodeId) {
        ids.add(edge.source);
        ids.add(edge.target);
      }
    });
    return ids;
  }, [selectedNodeId, visibleEdges]);

  const selectedNode = visibleNodes.find((node) => node.id === selectedNodeId) || null;
  const selectedRelations = selectedNode
    ? visibleEdges.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id)
    : [];

  const updateDraft = (key, value) => {
    setDraft((current) => ({ ...current, produto_id: '', [key]: value }));
  };

  const aplicarFiltros = (event) => {
    event.preventDefault();
    setSelectedNodeId(null);
    setFiltros(draft);
  };

  const limparFiltros = () => {
    setDraft(EMPTY_FILTERS);
    setFiltros(EMPTY_FILTERS);
    setSelectedNodeId(null);
  };

  const focoNo = (node) => {
    const fieldByType = {
      produto: 'produto_id',
      maquina: 'maquina_id',
      departamento: 'departamento_id',
      supervisor: 'supervisor_id',
      fornecedor: 'fornecedor_id',
    };
    const field = fieldByType[node.type];
    if (!field || !node.refId) return;
    const next = { ...EMPTY_FILTERS, [field]: node.refId };
    setDraft(next);
    setFiltros(next);
    setSelectedNodeId(node.id);
  };

  const toggleTipo = (type) => {
    setTiposVisiveis((current) => ({ ...current, [type]: !current[type] }));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = (event) => {
    event.preventDefault();
    const next = Math.min(1.55, Math.max(0.62, zoom + (event.deltaY > 0 ? -0.08 : 0.08)));
    setZoom(Number(next.toFixed(2)));
  };

  const handleMouseDown = (event) => {
    if (event.button !== 0) return;
    setDrag({ x: event.clientX, y: event.clientY, pan });
  };

  const handleMouseMove = (event) => {
    if (!drag) return;
    setPan({
      x: drag.pan.x + event.clientX - drag.x,
      y: drag.pan.y + event.clientY - drag.y,
    });
  };

  const handleMouseUp = () => setDrag(null);

  const options = data?.opcoes || {};

  return (
    <div className="space-y-5 pb-10 animate-fade-in">
      <div className="page-intro">
        <div>
          <p className="page-kicker">Mapa operacional</p>
          <h1 className="text-xl sm:text-2xl font-black text-steel-900">Grafo de Relacionamentos</h1>
          <p className="mt-1 text-sm text-steel-500">
            Peça, estoque, máquina, departamento, supervisor, fornecedor e pedido em uma única leitura.
          </p>
        </div>
        <button type="button" onClick={() => refetch()} className="btn-secondary w-full sm:w-auto">
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      <form onSubmit={aplicarFiltros} className="card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-steel-700" />
          <h2 className="font-bold text-steel-900">Filtros do grafo</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="label">Busca</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-400" />
              <input
                className="input pl-9"
                value={draft.busca}
                onChange={(event) => updateDraft('busca', event.target.value)}
                placeholder="Código ou nome da peça"
              />
            </div>
          </label>

          <label className="block">
            <span className="label">Faixa Kanban</span>
            <select className="input" value={draft.faixa} onChange={(event) => updateDraft('faixa', event.target.value)}>
              <option value="">Todas</option>
              <option value="VERMELHO">Vermelho</option>
              <option value="AMARELO">Amarelo</option>
              <option value="VERDE">Verde</option>
              <option value="SEM_DADOS">Sem dados</option>
            </select>
          </label>

          <label className="block">
            <span className="label">Estoque</span>
            <select className="input" value={draft.estoque} onChange={(event) => updateDraft('estoque', event.target.value)}>
              <option value="">Qualquer saldo</option>
              <option value="critico">Abaixo do estoque de segurança</option>
              <option value="reposicao">Abaixo do ponto de reposição</option>
            </select>
          </label>

          <label className="block">
            <span className="label">Status do pedido</span>
            <select className="input" value={draft.status_pedido} onChange={(event) => updateDraft('status_pedido', event.target.value)}>
              <option value="">Todos</option>
              {STATUS_PEDIDO.map((status) => (
                <option key={status} value={status}>{labelStatus(status)}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="label">Máquina</span>
            <select className="input" value={draft.maquina_id} onChange={(event) => updateDraft('maquina_id', event.target.value)}>
              <option value="">Todas</option>
              {(options.maquinas || []).map((item) => (
                <option key={item.id} value={item.id}>{item.label} - {item.subtitle}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="label">Departamento</span>
            <select className="input" value={draft.departamento_id} onChange={(event) => updateDraft('departamento_id', event.target.value)}>
              <option value="">Todos</option>
              {(options.departamentos || []).map((item) => (
                <option key={item.id} value={item.id}>{item.label} - {item.subtitle}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="label">Supervisor</span>
            <select className="input" value={draft.supervisor_id} onChange={(event) => updateDraft('supervisor_id', event.target.value)}>
              <option value="">Todos</option>
              {(options.supervisores || []).map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="label">Fornecedor</span>
            <select className="input" value={draft.fornecedor_id} onChange={(event) => updateDraft('fornecedor_id', event.target.value)}>
              <option value="">Todos</option>
              {(options.fornecedores || []).map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="label">Pedido criado de</span>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-400" />
              <input
                type="date"
                className="input pl-9"
                value={draft.data_inicio}
                onChange={(event) => updateDraft('data_inicio', event.target.value)}
              />
            </div>
          </label>

          <label className="block">
            <span className="label">Pedido criado até</span>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-400" />
              <input
                type="date"
                className="input pl-9"
                value={draft.data_fim}
                onChange={(event) => updateDraft('data_fim', event.target.value)}
              />
            </div>
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={limparFiltros} className="btn-secondary">
            <RotateCcw className="h-4 w-4" />
            Limpar
          </button>
          <button type="submit" className="btn-primary">
            <Search className="h-4 w-4" />
            Aplicar filtros
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Não foi possível carregar o grafo: {error.message}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        <StatCard label="Peças" value={data?.stats?.produtos} />
        <StatCard label="Máquinas" value={data?.stats?.maquinas} />
        <StatCard label="Departamentos" value={data?.stats?.departamentos} />
        <StatCard label="Supervisores" value={data?.stats?.supervisores} />
        <StatCard label="Fornecedores" value={data?.stats?.fornecedores} />
        <StatCard label="Pedidos" value={data?.stats?.pedidos} />
        <StatCard label="Relações" value={data?.stats?.relacionamentos} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-steel-700/10 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5 text-steel-800" />
              <div>
                <h2 className="font-bold text-steel-900">Mapa de vínculos</h2>
                <p className="text-xs text-steel-500">Arraste o mapa e use a roda do mouse para aproximar.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-secondary min-h-9 px-3" onClick={() => setZoom((value) => Math.max(0.62, Number((value - 0.1).toFixed(2))))}>
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="min-w-14 text-center font-mono text-sm font-bold text-steel-700">{Math.round(zoom * 100)}%</span>
              <button type="button" className="btn-secondary min-h-9 px-3" onClick={() => setZoom((value) => Math.min(1.55, Number((value + 0.1).toFixed(2))))}>
                <ZoomIn className="h-4 w-4" />
              </button>
              <button type="button" className="btn-secondary min-h-9 px-3" onClick={resetView}>
                <RotateCcw className="h-4 w-4" />
                Recentrar
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-steel-700/10 p-3">
            {TYPE_ORDER.map((type) => {
              const meta = TYPE_META[type];
              const Icon = meta.icon;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleTipo(type)}
                  className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-bold transition-colors ${
                    tiposVisiveis[type]
                      ? 'border-steel-700/20 bg-white text-steel-900'
                      : 'border-steel-700/10 bg-steel-50 text-steel-400'
                  }`}
                >
                  <Icon className="h-4 w-4" style={{ color: tiposVisiveis[type] ? meta.color : '#91A0B7' }} />
                  {meta.label}
                </button>
              );
            })}
          </div>

          <div className="relative h-[620px] min-h-[520px] bg-white">
            {isLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
                <div className="flex items-center gap-3 rounded-md border border-steel-700/10 bg-white px-4 py-3 text-sm font-bold text-steel-700 shadow-control">
                  <RefreshCw className="h-4 w-4 animate-spin text-accent" />
                  Carregando grafo...
                </div>
              </div>
            )}

            {!isLoading && visibleNodes.length === 0 && <EmptyGraph />}

            <svg
              ref={svgRef}
              role="img"
              aria-label="Grafo de relacionamentos operacionais"
              className={`h-full w-full ${drag ? 'cursor-grabbing' : 'cursor-grab'}`}
              viewBox={`0 0 ${layout.canvasWidth} ${layout.canvasHeight}`}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <defs>
                <marker id="arrow-grafo" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#91A0B7" />
                </marker>
                <pattern id="grid-grafo" width="32" height="32" patternUnits="userSpaceOnUse">
                  <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#E8EEF7" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width={layout.canvasWidth} height={layout.canvasHeight} fill="url(#grid-grafo)" />

              <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
                {visibleEdges.map((edge) => {
                  const source = layout.positions.get(edge.source);
                  const target = layout.positions.get(edge.target);
                  const highlighted = !selectedNodeId || edge.source === selectedNodeId || edge.target === selectedNodeId;
                  return (
                    <g key={edge.id} opacity={highlighted ? 1 : 0.18}>
                      <path
                        d={buildPath(source, target)}
                        fill="none"
                        stroke={highlighted ? '#667085' : '#CDD7E6'}
                        strokeWidth={highlighted ? 2.2 : 1.4}
                        markerEnd="url(#arrow-grafo)"
                      />
                      {source && target && highlighted && (
                        <text
                          x={(source.x + target.x + NODE_W) / 2}
                          y={(source.y + target.y + NODE_H) / 2 - 8}
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="700"
                          fill="#3F4959"
                          paintOrder="stroke"
                          stroke="#ffffff"
                          strokeWidth="4"
                        >
                          {compactText(edge.label, 20)}
                        </text>
                      )}
                    </g>
                  );
                })}

                {visibleNodes.map((node) => {
                  const pos = layout.positions.get(node.id);
                  if (!pos) return null;
                  const meta = TYPE_META[node.type] || TYPE_META.produto;
                  const dimmed = selectedNodeId && !connectedIds.has(node.id);
                  const selected = selectedNodeId === node.id;
                  const Icon = meta.icon;
                  return (
                    <g
                      key={node.id}
                      data-node="true"
                      transform={`translate(${pos.x} ${pos.y})`}
                      opacity={dimmed ? 0.22 : 1}
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedNodeId(node.id);
                      }}
                      className="cursor-pointer"
                    >
                      <rect
                        width={NODE_W}
                        height={NODE_H}
                        rx="8"
                        fill={selected ? '#DCEBFF' : meta.bg}
                        stroke={selected ? '#005DFF' : meta.color}
                        strokeWidth={selected ? 2.5 : 1.4}
                        filter={selected ? 'drop-shadow(0 10px 14px rgba(0,93,255,0.18))' : 'none'}
                      />
                      <circle cx="19" cy="20" r="10" fill="#ffffff" stroke={meta.color} strokeWidth="1" />
                      <foreignObject x="13" y="14" width="12" height="12">
                        <Icon size={12} color={meta.color} />
                      </foreignObject>
                      <text x="35" y="18" fontSize="12" fontWeight="900" fill="#000000">
                        {compactText(node.label, 16)}
                      </text>
                      <text x="35" y="35" fontSize="10" fontWeight="600" fill="#667085">
                        {compactText(node.subtitle, 18)}
                      </text>
                      <circle cx="134" cy="15" r="5" fill={statusColor(node.status)} />
                      <text x="10" y="51" fontSize="9" fontWeight="800" fill={statusColor(node.status)}>
                        {compactText(labelStatus(node.status), 22)}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-4">
            <div className="mb-3 flex items-center gap-2">
              <MousePointer2 className="h-5 w-5 text-steel-700" />
              <h2 className="font-bold text-steel-900">Detalhe do nó</h2>
            </div>
            {!selectedNode ? (
              <div className="rounded-md border border-dashed border-steel-700/20 p-4 text-sm text-steel-500">
                Selecione um nó no mapa para ver status, métricas e relações diretas.
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase text-steel-500">{TYPE_META[selectedNode.type]?.label || selectedNode.type}</p>
                      <h3 className="break-words text-lg font-black text-steel-900">{selectedNode.label}</h3>
                      <p className="text-sm text-steel-500">{selectedNode.subtitle}</p>
                    </div>
                    <span
                      className="rounded-full px-2 py-1 text-[10px] font-black uppercase text-white"
                      style={{ backgroundColor: statusColor(selectedNode.status) }}
                    >
                      {labelStatus(selectedNode.status)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedNode.href && (
                      <Link to={selectedNode.href} className="btn-secondary min-h-9 px-3 text-xs">
                        <ExternalLink className="h-4 w-4" />
                        Abrir
                      </Link>
                    )}
                    {['produto', 'maquina', 'departamento', 'supervisor', 'fornecedor'].includes(selectedNode.type) && (
                      <button type="button" onClick={() => focoNo(selectedNode)} className="btn-primary min-h-9 px-3 text-xs">
                        <Search className="h-4 w-4" />
                        Focar neste nó
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-xs font-bold uppercase text-steel-500">Métricas</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {Object.entries(selectedNode.metrics || {}).filter(([, value]) => value !== null && value !== undefined && value !== '').length === 0 ? (
                      <div className="rounded-md bg-steel-50 p-3 text-sm text-steel-500">Sem métricas adicionais.</div>
                    ) : (
                      Object.entries(selectedNode.metrics || {})
                        .filter(([, value]) => value !== null && value !== undefined && value !== '')
                        .map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between gap-3 rounded-md bg-steel-50 px-3 py-2 text-sm">
                            <span className="text-steel-500">{key.replace(/_/g, ' ')}</span>
                            <span className="text-right font-bold text-steel-900">{formatMetric(key, value)}</span>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Network className="h-5 w-5 text-steel-700" />
              <h2 className="font-bold text-steel-900">Relações diretas</h2>
            </div>
            {!selectedNode ? (
              <p className="text-sm text-steel-500">Escolha um nó para listar as conexões.</p>
            ) : selectedRelations.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                Nó sem conexões visíveis com os filtros atuais.
              </div>
            ) : (
              <div className="space-y-2">
                {selectedRelations.map((edge) => {
                  const otherId = edge.source === selectedNode.id ? edge.target : edge.source;
                  const other = visibleNodes.find((node) => node.id === otherId);
                  return (
                    <button
                      key={edge.id}
                      type="button"
                      onClick={() => setSelectedNodeId(otherId)}
                      className="w-full rounded-md border border-steel-700/10 bg-white p-3 text-left transition-colors hover:bg-steel-50"
                    >
                      <p className="text-[11px] font-bold uppercase text-steel-500">{edge.label}</p>
                      <p className="mt-1 font-bold text-steel-900">{other?.label || otherId}</p>
                      <p className="text-xs text-steel-500">{TYPE_META[other?.type]?.label || other?.type}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default GrafoRelacionamentos;
