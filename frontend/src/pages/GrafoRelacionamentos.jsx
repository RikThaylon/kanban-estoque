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
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
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
const NODE_W = 220;
const NODE_H = 90;

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

  const GAP_Y = 110;
  const maxColumn = Math.max(1, ...columns.map((column) => column.length));
  const canvasHeight = Math.max(720, 150 + maxColumn * GAP_Y);
  const positions = new Map();
  const columnX = [40, 300, 560, 820, 1080, 1340];

  columns.forEach((column, columnIndex) => {
    const blockHeight = Math.max(0, (column.length - 1) * GAP_Y);
    const startY = Math.max(54, (canvasHeight - blockHeight - NODE_H) / 2);
    column.forEach((node, index) => {
      positions.set(node.id, {
        x: columnX[columnIndex],
        y: startY + index * GAP_Y,
      });
    });
  });

  return { positions, canvasHeight, canvasWidth: 1600 };
}

function buildPath(source, target) {
  if (!source || !target) return '';
  const sx = source.x + NODE_W;
  const sy = source.y + NODE_H / 2;
  const tx = target.x;
  const ty = target.y + NODE_H / 2;
  // Increase bend radius to make overlapping lines more distinguishable
  const bend = Math.max(50, Math.abs(tx - sx) * 0.55);
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
  const svgRef = useRef(null);
  const touchRef = useRef({});
  
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [filtros, setFiltros] = useState(EMPTY_FILTERS);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [tiposVisiveis, setTiposVisiveis] = useState(
    Object.fromEntries(TYPE_ORDER.map((type) => [type, true]))
  );
  const [drag, setDrag] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

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
    setSelectedNodeId(node.id);
  };

  const toggleTipo = (type) => {
    setTiposVisiveis((current) => ({ ...current, [type]: !current[type] }));
  };

  const getTouchDist = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (event) => {
    if (event.touches.length === 2) {
      event.preventDefault();
      touchRef.current.lastDist = getTouchDist(event.touches);
      touchRef.current.lastCenter = {
        x: (event.touches[0].clientX + event.touches[1].clientX) / 2,
        y: (event.touches[0].clientY + event.touches[1].clientY) / 2,
      };
    } else if (event.touches.length === 1) {
      setDrag({ x: event.touches[0].clientX, y: event.touches[0].clientY, pan });
    }
  };

  const handleTouchMove = (event) => {
    if (event.touches.length === 2) {
      event.preventDefault();
      const dist = getTouchDist(event.touches);
      if (touchRef.current.lastDist) {
        const scale = dist / touchRef.current.lastDist;
        const next = Math.min(2.0, Math.max(0.3, zoom * scale));
        setZoom(Number(next.toFixed(2)));
      }
      touchRef.current.lastDist = dist;
    } else if (event.touches.length === 1 && drag) {
      setPan({
        x: drag.pan.x + event.touches[0].clientX - drag.x,
        y: drag.pan.y + event.touches[0].clientY - drag.y,
      });
    }
  };

  const handleTouchEnd = (event) => {
    if (event.touches.length < 2) {
      touchRef.current.lastDist = null;
      touchRef.current.lastCenter = null;
    }
    if (event.touches.length === 0) {
      setDrag(null);
    }
  };

  const [showFilters, setShowFilters] = useState(false);

  const activeFilterCount = useMemo(() => {
    return Object.entries(filtros).filter(([, v]) => v !== '' && v !== null && v !== undefined).length;
  }, [filtros]);

  const options = data?.opcoes || {};

  return (
    <div className="space-y-4 pb-10 animate-fade-in">
      <div className="page-intro">
        <div>
          <p className="page-kicker">Mapa operacional</p>
          <h1 className="text-xl sm:text-2xl font-black text-steel-900">Informações</h1>
          <p className="mt-1 text-sm text-steel-500">
            Visualize peças, estoque, máquinas e pedidos em uma única leitura.
          </p>
        </div>
        <button type="button" onClick={() => refetch()} className="btn-secondary w-full sm:w-auto">
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* --- Compact Filter Bar --- */}
      <form onSubmit={aplicarFiltros} className="card overflow-hidden">
        {/* Always-visible: search + toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 p-4">
          <label className="flex-1 min-w-0 block">
            <span className="label">Busca rápida</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-400" />
              <input
                className="input pl-9"
                value={draft.busca}
                onChange={(event) => updateDraft('busca', event.target.value)}
                placeholder="Código ou nome da peça..."
              />
            </div>
          </label>

          <label className="sm:w-44 block">
            <span className="label">Faixa Kanban</span>
            <select className="input" value={draft.faixa} onChange={(event) => updateDraft('faixa', event.target.value)}>
              <option value="">Todas</option>
              <option value="VERMELHO">Vermelho</option>
              <option value="AMARELO">Amarelo</option>
              <option value="VERDE">Verde</option>
              <option value="SEM_DADOS">Sem dados</option>
            </select>
          </label>

          <div className="flex gap-2 sm:pb-0.5">
            <button type="submit" className="btn-primary flex-1 sm:flex-initial">
              <Search className="h-4 w-4" />
              Filtrar
            </button>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-secondary relative flex-1 sm:flex-initial ${showFilters ? 'ring-2 ring-accent/30' : ''}`}
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">{showFilters ? 'Menos' : 'Mais'} filtros</span>
              <span className="sm:hidden">{showFilters ? 'Menos' : 'Mais'}</span>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-black text-white shadow-sm">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Collapsible advanced filters */}
        {showFilters && (
          <div className="border-t border-steel-700/10 bg-steel-50/50 p-4 animate-fade-in">
            <p className="text-xs font-bold uppercase text-steel-500 mb-3">Filtros avançados</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

            <div className="mt-4 flex justify-end">
              <button type="button" onClick={limparFiltros} className="btn-secondary text-xs">
                <RotateCcw className="h-3.5 w-3.5" />
                Limpar todos
              </button>
            </div>
          </div>
        )}
      </form>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Não foi possível carregar as informações: {error.message}
        </div>
      )}

      {/* --- Compact Stats Strip --- */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Peças', value: data?.stats?.produtos },
          { label: 'Máquinas', value: data?.stats?.maquinas },
          { label: 'Deptos', value: data?.stats?.departamentos },
          { label: 'Supervisores', value: data?.stats?.supervisores },
          { label: 'Fornecedores', value: data?.stats?.fornecedores },
          { label: 'Pedidos', value: data?.stats?.pedidos },
          { label: 'Relações', value: data?.stats?.relacionamentos },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-2 rounded-lg border border-steel-700/10 bg-white px-3 py-2 text-sm shadow-sm"
          >
            <span className="text-steel-500 text-xs font-bold uppercase">{stat.label}</span>
            <span className="font-black text-steel-900">{stat.value ?? 0}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="card overflow-hidden">
          {/* Integrated Toolbar */}
          <div className="flex flex-col border-b border-steel-700/10 bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-steel-50 border border-steel-700/10 shadow-inner">
                  <Network className="h-5 w-5 text-steel-700" />
                </div>
                <div>
                  <h2 className="font-bold text-steel-900 leading-tight">Mapa de vínculos</h2>
                  <p className="text-xs text-steel-500">Arraste para mover · Scroll/Pinça para zoom</p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                {/* Botões do mapa ficarão dentro do TransformWrapper */}
              </div>
            </div>
            
            <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
              <span className="text-[10px] font-black uppercase tracking-wider text-steel-400 mr-1 shrink-0">Mostrar:</span>
              {TYPE_ORDER.map((type) => {
                const meta = TYPE_META[type];
                const Icon = meta.icon;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleTipo(type)}
                    className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all ${
                      tiposVisiveis[type]
                        ? 'border-steel-700/20 bg-white text-steel-800 shadow-sm'
                        : 'border-transparent bg-steel-50/50 text-steel-400 hover:bg-steel-50'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color: tiposVisiveis[type] ? meta.color : 'currentColor' }} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative h-[420px] sm:h-[520px] lg:h-[620px] bg-white touch-none">
            {isLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
                <div className="flex items-center gap-3 rounded-md border border-steel-700/10 bg-white px-4 py-3 text-sm font-bold text-steel-700 shadow-control">
                  <RefreshCw className="h-4 w-4 animate-spin text-accent" />
                  Carregando informações...
                </div>
              </div>
            )}

            {!isLoading && visibleNodes.length === 0 && <EmptyGraph />}

            <TransformWrapper
              initialScale={1}
              minScale={0.1}
              maxScale={3}
              centerOnInit={true}
              wheel={{ step: 0.08 }}
              pinch={{ step: 5 }}
            >
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  <div className="absolute top-4 right-4 z-10 flex flex-col sm:flex-row items-center gap-1 rounded-lg bg-white/90 backdrop-blur-sm p-1 border border-steel-700/20 shadow-md">
                    <button type="button" className="p-2 text-steel-700 hover:bg-steel-50 hover:text-accent rounded-md transition-all" onClick={() => zoomOut()}>
                      <ZoomOut className="h-5 w-5" />
                    </button>
                    <button type="button" className="p-2 text-steel-700 hover:bg-steel-50 hover:text-accent rounded-md transition-all" onClick={() => zoomIn()}>
                      <ZoomIn className="h-5 w-5" />
                    </button>
                    <div className="hidden sm:block w-px h-5 bg-steel-700/15 mx-1"></div>
                    <button type="button" className="p-2 text-steel-700 hover:bg-steel-50 hover:text-accent rounded-md transition-all flex items-center gap-2 px-3" onClick={() => resetTransform()}>
                      <RotateCcw className="h-4 w-4" />
                      <span className="hidden sm:inline text-xs font-bold">Recentrar</span>
                    </button>
                  </div>

                  <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full">
                    <svg
                      ref={svgRef}
                      role="img"
                      aria-label="Mapa de informações operacionais"
                      className="h-full w-full cursor-grab active:cursor-grabbing"
                      viewBox={`0 0 ${layout.canvasWidth} ${layout.canvasHeight}`}
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

                      <g>
                {visibleEdges.map((edge) => {
                  const source = layout.positions.get(edge.source);
                  const target = layout.positions.get(edge.target);
                  const highlighted = !selectedNodeId || edge.source === selectedNodeId || edge.target === selectedNodeId;
                  return (
                    <g key={edge.id} opacity={highlighted ? 1 : 0.18}>
                      <path
                        d={buildPath(source, target)}
                        fill="none"
                        stroke={highlighted ? '#667085' : '#E8EEF7'}
                        strokeWidth={highlighted ? 2.2 : 1.4}
                        markerEnd="url(#arrow-grafo)"
                      />
                      {source && target && highlighted && selectedNodeId && (
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
                      opacity={dimmed ? 0.15 : 1}
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedNodeId(node.id);
                      }}
                      className="cursor-pointer transition-opacity duration-200"
                    >
                      <rect
                        width={NODE_W}
                        height={NODE_H}
                        rx="12"
                        fill={selected ? '#DCEBFF' : meta.bg}
                        stroke={selected ? '#005DFF' : meta.color}
                        strokeWidth={selected ? 2.5 : 1.5}
                        filter={selected ? 'drop-shadow(0 10px 14px rgba(0,93,255,0.18))' : 'none'}
                      />
                      <foreignObject x="0" y="0" width={NODE_W} height={NODE_H}>
                        <div className="flex h-full w-full flex-col justify-between p-3" xmlns="http://www.w3.org/1999/xhtml">
                          <div className="flex items-start gap-2 h-full overflow-hidden">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white shadow-sm mt-0.5" style={{ border: `1px solid ${meta.color}` }}>
                              <Icon size={14} color={meta.color} />
                            </div>
                            <div className="flex flex-col flex-1 min-w-0 pr-1">
                              <span className="text-[13px] font-black text-steel-900 leading-tight break-words line-clamp-3" title={node.label}>
                                {node.label}
                              </span>
                              <span className="text-[11px] font-bold text-steel-500 mt-1 break-words line-clamp-2 leading-tight" title={node.subtitle}>
                                {node.subtitle || '-'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-1.5 mt-2 pt-2 border-t border-steel-700/10">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColor(node.status) }} />
                            <span className="text-[9px] font-black uppercase tracking-wide" style={{ color: statusColor(node.status) }}>
                              {compactText(labelStatus(node.status), 16)}
                            </span>
                          </div>
                        </div>
                      </foreignObject>
                    </g>
                  );
                })}
              </g>
            </svg>
           </TransformComponent>
         </>
       )}
     </TransformWrapper>
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
