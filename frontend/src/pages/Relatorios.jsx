import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  TrendingUp, Users, Package, Layers, ShoppingCart, AlertCircle,
  Activity, Target, ChevronDown, ChevronUp, Plus, X, CheckCircle,
  AlertTriangle, XCircle, Calendar, DollarSign, Award, BarChart2,
} from 'lucide-react';
import api from '../services/api';
import { formatMoney, formatNumber } from '../utils/formatters';
import { useAuthStore } from '../stores/authStore';

const PERIODOS = [
  { value: 7, label: 'Ultimos 7 dias' },
  { value: 30, label: 'Ultimos 30 dias' },
  { value: 90, label: 'Ultimos 90 dias' },
  { value: 180, label: 'Ultimos 180 dias' },
  { value: 365, label: 'Ultimo ano' },
];

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function mesLabel(anoMes) {
  if (!anoMes) return '';
  const [ano, mes] = anoMes.split('-');
  return `${MESES_PT[parseInt(mes, 10) - 1]}/${ano?.slice(2)}`;
}

function statusMetaConfig(status) {
  switch (status) {
    case 'estourado':
      return {
        color: 'text-red-700',
        bg: 'bg-red-50',
        border: 'border-red-200',
        pillBg: 'bg-red-100 text-red-800',
        icon: XCircle,
        label: 'Estourado',
      };
    case 'alerta':
      return {
        color: 'text-amber-800',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        pillBg: 'bg-amber-100 text-amber-800',
        icon: AlertTriangle,
        label: 'Alerta',
      };
    case 'dentro':
      return {
        color: 'text-emerald-800',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        pillBg: 'bg-emerald-100 text-emerald-800',
        icon: CheckCircle,
        label: 'No limite',
      };
    default:
      return {
        color: 'text-steel-700',
        bg: 'bg-surface-50',
        border: 'border-surface-200',
        pillBg: 'bg-surface-100 text-steel-700',
        icon: Calendar,
        label: 'Sem meta',
      };
  }
}

function KpiCard({ icon: Icon, color, bg, label, value, sub }) {
  return (
    <div className="card p-4 flex items-start gap-3 bg-white border border-surface-200 shadow-sm">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <div className="text-xs text-steel-500 font-medium">{label}</div>
        <div className="text-xl font-bold text-steel-900 mt-0.5">{value ?? '-'}</div>
        {sub && <div className="text-xs text-steel-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function EmptyMsg({ msg }) {
  return <div className="py-6 text-center text-xs text-steel-400 font-medium">{msg}</div>;
}

function ProgressBar({ pct, status }) {
  const w = Math.min(pct ?? 0, 100);
  return (
    <div className="w-full bg-surface-200 rounded-full h-2 overflow-hidden">
      <div
        className={`h-2 rounded-full transition-all duration-700 ${
          status === 'estourado' ? 'bg-red-500' :
          status === 'alerta' ? 'bg-amber-500' : 'bg-emerald-500'
        }`}
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

function ModalDefinirMeta({ open, onClose, metas, onSave }) {
  const [anoMes, setAnoMes] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [valor, setValor] = useState('');

  if (!open) return null;

  function handleSalvar() {
    const v = parseFloat(valor.replace(',', '.'));
    if (!anoMes || isNaN(v) || v < 0) return;
    onSave({ ano_mes: anoMes, meta_valor: v });
    setValor('');
  }

  const metasOrdenadas = Object.entries(metas || {}).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-surface-200">
        <div className="flex items-center justify-between p-5 border-b border-surface-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-accent" />
            </div>
            <h2 className="text-lg font-bold text-steel-900">Definir Meta de Gastos</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100 text-steel-400 hover:text-steel-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-steel-600 mb-1.5">Mês / Ano</label>
              <input type="month" value={anoMes} onChange={e => setAnoMes(e.target.value)} className="input w-full text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-steel-600 mb-1.5">Meta (R$)</label>
              <input type="number" min="0" step="100" placeholder="0,00" value={valor} onChange={e => setValor(e.target.value)} className="input w-full text-sm" />
            </div>
          </div>
          <button onClick={handleSalvar} disabled={!anoMes || !valor} className="btn-primary w-full flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" />Salvar Meta
          </button>
          {metasOrdenadas.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-steel-500 uppercase tracking-wider mb-2">Metas cadastradas</div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {metasOrdenadas.map(([mes, val]) => (
                  <div key={mes} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-50 border border-surface-100">
                    <span className="text-sm font-medium text-steel-800">{mesLabel(mes)}</span>
                    <span className="text-sm font-mono font-bold text-emerald-700">{formatMoney(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MesRow({ linha }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = statusMetaConfig(linha.status_meta);
  const Icon = cfg.icon;

  const temDados = (linha.top_saida?.length > 0) || (linha.top_gasto_compras?.length > 0) || (linha.itens?.length > 0);

  return (
    <div className={`rounded-xl border ${cfg.border} bg-white shadow-sm overflow-hidden transition-all mb-3`}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between p-4 bg-white hover:bg-surface-50 transition-colors text-left border-b border-surface-100"
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="w-16 text-center flex-shrink-0">
            <div className="text-base font-bold text-steel-900">{mesLabel(linha.mes_chegada)}</div>
          </div>

          <div className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${cfg.pillBg} border ${cfg.border} flex-shrink-0`}>
            <Icon className="w-3.5 h-3.5" />
            <span>{cfg.label}</span>
          </div>

          <div className="flex-1 min-w-0 mx-2">
            <div className="flex items-center justify-between mb-1">
              {linha.meta_valor ? (
                <div className="text-xs font-medium text-steel-600">
                  Previsto: <span className="font-bold text-steel-900 font-mono">{formatMoney(linha.valor_total_previsto)}</span> / Meta: <span className="font-mono text-steel-700">{formatMoney(linha.meta_valor)}</span>
                </div>
              ) : (
                <div className="text-xs font-medium text-steel-600">
                  Previsto: <span className="font-bold text-steel-900 font-mono">{formatMoney(linha.valor_total_previsto)}</span>
                </div>
              )}
              {linha.percentual_meta !== null && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${cfg.pillBg}`}>
                  {linha.percentual_meta}%
                </span>
              )}
            </div>
            {linha.meta_valor && (
              <ProgressBar pct={linha.percentual_meta} status={linha.status_meta} />
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0 ml-3">
          <div className="text-xs font-semibold text-steel-700 bg-surface-100 px-3 py-1.5 rounded-lg border border-surface-200">
            {linha.qtd_ordens} {linha.qtd_ordens === 1 ? 'OC' : 'OCs'}
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-steel-500" /> : <ChevronDown className="w-4 h-4 text-steel-500" />}
        </div>
      </button>

      {expanded && (
        <div className="p-4 bg-surface-50 border-t border-surface-200">
          {!temDados ? (
            <div className="py-4 text-center text-xs text-steel-500 font-medium bg-white rounded-lg border border-surface-200">
              Nenhuma movimentação ou ordem de compra prevista para este mês.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Mais Saídas */}
              <div className="bg-white rounded-lg border border-surface-200 p-3.5 shadow-sm">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-surface-100">
                  <Package className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-steel-700 uppercase tracking-wider">Mais saídas (Qtd)</span>
                </div>
                {linha.top_saida?.length ? (
                  <div className="divide-y divide-surface-100">
                    {linha.top_saida.map((item, i) => (
                      <div key={item.produto_id} className="py-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-5 text-center text-xs font-bold text-steel-400">{i + 1}</span>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-steel-800 truncate">{item.nome}</div>
                            <div className="text-[11px] text-steel-500 font-mono">{item.codigo}</div>
                          </div>
                        </div>
                        <div className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                          {formatNumber(item.quantidade_total)} {item.unidade}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <EmptyMsg msg="Sem saídas registradas neste mês" />}
              </div>

              {/* Maior Gasto */}
              <div className="bg-white rounded-lg border border-surface-200 p-3.5 shadow-sm">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-surface-100">
                  <DollarSign className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-steel-700 uppercase tracking-wider">Maior gasto em compras</span>
                </div>
                {linha.top_gasto_compras?.length ? (
                  <div className="divide-y divide-surface-100">
                    {linha.top_gasto_compras.map((item, i) => (
                      <div key={item.produto_id} className="py-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-5 text-center text-xs font-bold text-steel-400">{i + 1}</span>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-steel-800 truncate">{item.nome}</div>
                            <div className="text-[11px] text-steel-500 font-mono">{item.codigo}</div>
                          </div>
                        </div>
                        <div className="text-xs font-mono font-bold text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-100">
                          {formatMoney(item.valor_total_compras)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <EmptyMsg msg="Sem compras registradas neste mês" />}
              </div>

              {/* Ordens de Compra Previstas */}
              {linha.itens?.length > 0 && (
                <div className="md:col-span-2 bg-white rounded-lg border border-surface-200 p-3.5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-surface-100">
                    <ShoppingCart className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-steel-700 uppercase tracking-wider">Ordens de compra previstas</span>
                  </div>
                  <div className="divide-y divide-surface-100 max-h-56 overflow-y-auto">
                    {linha.itens.map(oc => {
                      const statusStyle =
                        oc.status === 'EM_TRANSITO' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        oc.status === 'APROVADO' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        'bg-surface-100 text-steel-700 border-surface-200';
                      return (
                        <div key={oc.pedido_id} className="py-2 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs font-mono font-semibold text-steel-700 bg-surface-100 px-2 py-0.5 rounded">
                              {oc.numero || `#${String(oc.pedido_id).slice(0,8)}`}
                            </span>
                            <span className="text-xs font-medium text-steel-800 truncate">{oc.produto_nome}</span>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusStyle}`}>
                              {oc.status?.replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs font-mono font-bold text-steel-900">{formatMoney(oc.valor_aberto)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-surface-200 rounded-xl p-3 shadow-lg text-xs">
      <div className="font-bold text-steel-900 mb-1.5">{label}</div>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-steel-600 font-medium">{p.name}:</span>
          <span className="font-mono font-bold text-steel-900">{formatMoney(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

const Relatorios = () => {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [periodo, setPeriodo] = useState(30);
  const [showMetaModal, setShowMetaModal] = useState(false);

  const { data: permissoesData } = useQuery({
    queryKey: ['configuracoes', 'permissoes'],
    queryFn: async () => (await api.get('/configuracoes/permissoes')).data,
    staleTime: 60_000,
  });

  const podeDefinirMeta = user?.perfil === 'admin' || (permissoesData?.definir_meta_gastos || []).includes(user?.perfil);

  const { data: stats } = useQuery({
    queryKey: ['relatorios', 'estatisticas-gerais', periodo],
    queryFn: async () => (await api.get('/relatorios/estatisticas-gerais', { params: { periodo } })).data,
  });

  const { data: topSolicitantes } = useQuery({
    queryKey: ['relatorios', 'top-solicitantes', periodo],
    queryFn: async () => (await api.get('/relatorios/top-solicitantes', { params: { periodo, limit: 5 } })).data,
  });

  const { data: topProdutos } = useQuery({
    queryKey: ['relatorios', 'top-produtos-saida', periodo],
    queryFn: async () => (await api.get('/relatorios/top-produtos-saida', { params: { periodo, limit: 5 } })).data,
  });

  const { data: porCategoria } = useQuery({
    queryKey: ['relatorios', 'consumo-por-categoria', periodo],
    queryFn: async () => (await api.get('/relatorios/consumo-por-categoria', { params: { periodo } })).data,
  });

  const { data: previsao, isLoading: loadingPrevisao } = useQuery({
    queryKey: ['relatorios', 'previsao-gastos-mensal'],
    queryFn: async () => (await api.get('/relatorios/previsao-gastos-mensal', { params: { meses: 12 } })).data,
  });

  const salvarMeta = useMutation({
    mutationFn: async (body) => (await api.post('/relatorios/metas-gastos', body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['relatorios', 'previsao-gastos-mensal'] });
      setShowMetaModal(false);
    },
  });

  const chartData = useMemo(() =>
    (previsao?.linhas || []).map(l => ({
      mes: mesLabel(l.mes_chegada),
      Previsto: l.valor_total_previsto,
      Meta: l.meta_valor,
    })),
    [previsao]
  );

  const pieData = useMemo(() =>
    (porCategoria || []).slice(0, 6).map(c => ({
      name: c.categoria_nome,
      value: c.valor_total,
      cor: c.cor_hex ? `#${c.cor_hex}` : '#94a3b8',
    })),
    [porCategoria]
  );

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-steel-800 tracking-tight">Relatorios & Dashboard</h1>
          <p className="text-steel-400 text-sm mt-1">Visao consolidada de consumo, gastos e metas mensais</p>
        </div>
        <div className="flex items-center gap-3">
          {podeDefinirMeta && (
            <button onClick={() => setShowMetaModal(true)} className="btn-primary flex items-center gap-2 text-sm">
              <Target className="w-4 h-4" />Definir Meta
            </button>
          )}
          <select value={periodo} onChange={e => setPeriodo(Number(e.target.value))} className="input text-sm">
            {PERIODOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {/* KPIs operacionais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Activity} color="text-accent" bg="bg-red-100" label="Saidas no periodo" value={formatNumber(stats?.movimentacoes?.saidas)} />
        <KpiCard icon={TrendingUp} color="text-red-600" bg="bg-red-100" label="Valor consumido" value={formatMoney(stats?.financeiro?.valor_consumido)} />
        <KpiCard icon={ShoppingCart} color="text-green-600" bg="bg-green-100" label="Compras emitidas" value={formatMoney(stats?.pedidos?.custo_total)} sub={`${stats?.pedidos?.total || 0} pedidos`} />
        <KpiCard icon={AlertCircle} color="text-amber-600" bg="bg-amber-100" label="Aprovacoes pendentes" value={formatNumber(stats?.pendencias?.movimentacoes_aguardando_aprovacao)} />
      </div>

      {/* KPIs de metas */}
      {previsao && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard icon={Target} color="text-blue-600" bg="bg-blue-100" label="Meta total do periodo" value={formatMoney(previsao.total_meta_periodo)} />
          <KpiCard icon={DollarSign} color="text-accent" bg="bg-red-100" label="Previsto total (chegada)" value={formatMoney(previsao.total_previsto_periodo)} sub={previsao.percentual_meta_global !== null ? `${previsao.percentual_meta_global}% da meta` : 'Sem meta global'} />
          <KpiCard icon={BarChart2} color="text-violet-600" bg="bg-violet-100" label="Meses com meta" value={Object.keys(previsao.metas || {}).length} sub="meses configurados" />
        </div>
      )}

      {/* Grafico Meta vs Previsto */}
      {chartData.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-5 h-5 text-steel-600" />
            <h2 className="text-lg font-bold text-steel-800">Meta vs Previsto - por mes de chegada</h2>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} barGap={4} barCategoryGap="30%">
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              <Bar dataKey="Meta" name="Meta" fill="#3b82f6" radius={[4,4,0,0]} opacity={0.7} />
              <Bar dataKey="Previsto" name="Previsto" fill="#ef4444" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Solicitantes + Top Produtos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-steel-600" />
            <h2 className="text-lg font-bold text-steel-800">Quem mais consome</h2>
          </div>
          {!topSolicitantes?.length ? <EmptyMsg msg="Sem dados de solicitacoes no periodo" /> : (
            <div className="space-y-2">
              {topSolicitantes.map((u, idx) => (
                <div key={u.usuario_id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-red-100 text-accent font-bold flex items-center justify-center text-sm flex-shrink-0">{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-steel-800 truncate">{u.nome}</div>
                    <div className="text-xs text-steel-500">@{u.username} - {u.perfil}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-semibold text-steel-800">{formatMoney(u.valor_total)}</div>
                    <div className="text-xs text-steel-500">{u.total_movimentacoes} mov.</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-bold text-steel-800">Materiais que mais saem</h2>
          </div>
          {!topProdutos?.length ? <EmptyMsg msg="Sem saidas registradas no periodo" /> : (
            <div className="space-y-2">
              {topProdutos.map((p, idx) => (
                <div key={p.produto_id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-bold flex items-center justify-center text-sm flex-shrink-0">{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-steel-800 truncate">{p.nome}</div>
                    <div className="text-xs text-steel-500">{p.codigo} - {p.classificacao_abc || '-'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-semibold text-steel-800">{formatMoney(p.valor_total)}</div>
                    <div className="text-xs text-steel-500">{formatNumber(p.quantidade_total)} {p.unidade}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Consumo por categoria */}
      {pieData.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-steel-600" />
            <h2 className="text-lg font-bold text-steel-800">Consumo por categoria</h2>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <ResponsiveContainer width={220} height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={90}>
                  {pieData.map((entry) => <Cell key={entry.name} fill={entry.cor} />)}
                </Pie>
                <Tooltip formatter={v => formatMoney(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {pieData.map(c => (
                <div key={c.name} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c.cor }} />
                  <span className="text-sm text-steel-700 flex-1 truncate">{c.name}</span>
                  <span className="text-sm font-mono font-semibold text-steel-800">{formatMoney(c.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Calendario de metas por mes */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-steel-600" />
            <h2 className="text-lg font-bold text-steel-800">Metas & Previsao por Mes de Chegada</h2>
          </div>
          <div className="flex items-center gap-4 text-xs text-steel-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> No limite</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Alerta</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Estourado</span>
          </div>
        </div>
        {loadingPrevisao && <EmptyMsg msg="Carregando previsoes..." />}
        {!loadingPrevisao && !previsao?.linhas?.length && <EmptyMsg msg="Nenhuma previsao de chegada encontrada" />}
        <div className="space-y-2">
          {(previsao?.linhas || []).map(linha => <MesRow key={linha.mes_chegada} linha={linha} />)}
        </div>
      </div>

      {/* Modal de meta */}
      <ModalDefinirMeta
        open={showMetaModal}
        onClose={() => setShowMetaModal(false)}
        metas={previsao?.metas || {}}
        onSave={salvarMeta.mutate}
      />
    </div>
  );
};

export default Relatorios;
