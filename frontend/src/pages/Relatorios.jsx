import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp, Users, Package, Layers, ShoppingCart, AlertCircle, Activity, CalendarClock } from 'lucide-react';
import api from '../services/api';
import { formatMoney, formatNumber } from '../utils/formatters';

const PERIODOS = [
  { value: 7, label: 'Últimos 7 dias' },
  { value: 30, label: 'Últimos 30 dias' },
  { value: 90, label: 'Últimos 90 dias' },
  { value: 180, label: 'Últimos 180 dias' },
  { value: 365, label: 'Último ano' },
];

const Relatorios = () => {
  const [periodo, setPeriodo] = useState(30);

  // KPIs gerais
  const { data: stats } = useQuery({
    queryKey: ['relatorios', 'estatisticas-gerais', periodo],
    queryFn: async () => (await api.get('/relatorios/estatisticas-gerais', { params: { periodo } })).data,
  });

  // Top solicitantes
  const { data: topSolicitantes } = useQuery({
    queryKey: ['relatorios', 'top-solicitantes', periodo],
    queryFn: async () => (await api.get('/relatorios/top-solicitantes', { params: { periodo, limit: 10 } })).data,
  });

  // Top produtos
  const { data: topProdutos } = useQuery({
    queryKey: ['relatorios', 'top-produtos-saida', periodo],
    queryFn: async () => (await api.get('/relatorios/top-produtos-saida', { params: { periodo, limit: 10 } })).data,
  });

  // Consumo por categoria
  const { data: porCategoria } = useQuery({
    queryKey: ['relatorios', 'consumo-por-categoria', periodo],
    queryFn: async () => (await api.get('/relatorios/consumo-por-categoria', { params: { periodo } })).data,
  });

  // Curva ABC
  const { data: curvaAbc } = useQuery({
    queryKey: ['relatorios', 'curva-abc'],
    queryFn: async () => (await api.get('/relatorios/curva-abc')).data,
  });

  // Giro de estoque
  const { data: giroEstoque } = useQuery({
    queryKey: ['relatorios', 'giro-estoque'],
    queryFn: async () => (await api.get('/relatorios/giro-estoque')).data,
  });

  // Previsão de gastos por mês de chegada
  const { data: previsao } = useQuery({
    queryKey: ['relatorios', 'previsao-gastos-mensal'],
    queryFn: async () => (await api.get('/relatorios/previsao-gastos-mensal', { params: { meses: 12 } })).data,
  });

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-800 tracking-tight">Relatórios e Análises</h1>
          <p className="text-navy-400 text-sm mt-1">Visão consolidada de consumo, gastos e desempenho</p>
        </div>
        <select value={periodo} onChange={e => setPeriodo(Number(e.target.value))} className="input">
          {PERIODOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Activity}
          color="text-blue-600"
          bg="bg-blue-100"
          label="Saídas no período"
          value={formatNumber(stats?.movimentacoes?.saidas)}
        />
        <KpiCard
          icon={TrendingUp}
          color="text-red-600"
          bg="bg-red-100"
          label="Valor consumido"
          value={formatMoney(stats?.financeiro?.valor_consumido)}
        />
        <KpiCard
          icon={ShoppingCart}
          color="text-green-600"
          bg="bg-green-100"
          label="Compras emitidas"
          value={formatMoney(stats?.pedidos?.custo_total)}
          sub={`${stats?.pedidos?.total || 0} pedidos`}
        />
        <KpiCard
          icon={AlertCircle}
          color="text-amber-600"
          bg="bg-amber-100"
          label="Aprovações pendentes"
          value={formatNumber(stats?.pendencias?.movimentacoes_aguardando_aprovacao)}
        />
      </div>

      {/* Top Solicitantes + Top Produtos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-navy-600" />
            <h2 className="text-lg font-bold text-navy-800">Quem mais consome</h2>
          </div>
          {!topSolicitantes?.length ? (
            <EmptyMsg msg="Sem dados de solicitações no período" />
          ) : (
            <div className="space-y-2">
              {topSolicitantes.map((u, idx) => (
                <div key={u.usuario_id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-navy-100 text-navy-700 font-bold flex items-center justify-center text-sm">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-navy-800 truncate">{u.nome}</div>
                    <div className="text-xs text-navy-500">@{u.username} · {u.perfil}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-semibold text-navy-800">{formatMoney(u.valor_total)}</div>
                    <div className="text-xs text-navy-500">{u.total_movimentacoes} mov.</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-navy-600" />
            <h2 className="text-lg font-bold text-navy-800">Materiais que mais saem</h2>
          </div>
          {!topProdutos?.length ? (
            <EmptyMsg msg="Sem saídas registradas no período" />
          ) : (
            <div className="space-y-2">
              {topProdutos.map((p, idx) => (
                <div key={p.produto_id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-navy-100 text-navy-700 font-bold flex items-center justify-center text-sm">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-navy-800 truncate">
                      <span className="font-mono">{p.codigo}</span> · {p.nome}
                    </div>
                    <div className="text-xs text-navy-500">
                      {p.categoria_nome || '—'}
                      {p.classificacao_abc && <span className="ml-1 px-1.5 py-0.5 bg-navy-100 text-navy-700 rounded font-medium">{p.classificacao_abc}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-semibold text-navy-800">{formatMoney(p.valor_total)}</div>
                    <div className="text-xs text-navy-500">{formatNumber(p.quantidade_total)} {p.unidade}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Consumo por categoria */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-5 h-5 text-navy-600" />
          <h2 className="text-lg font-bold text-navy-800">Onde está sendo gasto (por categoria)</h2>
        </div>
        {!porCategoria?.length ? (
          <EmptyMsg msg="Sem consumo registrado no período" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={porCategoria}
                    dataKey="valor_total"
                    nameKey="categoria_nome"
                    cx="50%" cy="50%" outerRadius={90}
                    label={(e) => `${e.percentual.toFixed(0)}%`}
                  >
                    {porCategoria.map((c, i) => (
                      <Cell key={i} fill={`#${c.cor_hex}`} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatMoney(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {porCategoria.map(c => (
                <div key={c.categoria_id} className="flex items-center gap-3 p-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: `#${c.cor_hex}` }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-navy-800 truncate">{c.categoria_nome}</div>
                    <div className="text-xs text-navy-500">{c.total_produtos} produtos · {c.total_movimentacoes} mov.</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono font-semibold text-navy-800">{formatMoney(c.valor_total)}</div>
                    <div className="text-xs text-navy-500">{c.percentual.toFixed(1)}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Curva ABC */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-navy-600" />
          <h2 className="text-lg font-bold text-navy-800">Curva ABC (por valor de consumo anual)</h2>
        </div>
        {!curvaAbc?.length ? (
          <EmptyMsg msg="Sem dados para classificar" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-sm">
              <thead className="bg-surface-50 text-navy-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left">Posição</th>
                  <th className="px-3 py-2 text-left">Código</th>
                  <th className="px-3 py-2 text-left">Nome</th>
                  <th className="px-3 py-2 text-right">Valor consumo</th>
                  <th className="px-3 py-2 text-right">% acumulado</th>
                  <th className="px-3 py-2 text-center">Classe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {curvaAbc.slice(0, 20).map((p, idx) => (
                  <tr key={p.produto_id} className="hover:bg-surface-50">
                    <td className="px-3 py-2 text-navy-500">{idx + 1}</td>
                    <td className="px-3 py-2 font-mono font-medium text-navy-800">{p.codigo}</td>
                    <td className="px-3 py-2 text-navy-600 truncate max-w-xs">{p.nome}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatMoney(p.valor_consumo)}</td>
                    <td className="px-3 py-2 text-right font-mono">{p.acumulado.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                        p.classificacao_abc === 'A' ? 'bg-red-100 text-red-700' :
                        p.classificacao_abc === 'B' ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}>{p.classificacao_abc}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Previsão de gastos por mês de chegada */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-navy-600" />
            <h2 className="text-lg font-bold text-navy-800">Previsão de gastos por mês de chegada</h2>
          </div>
          {previsao && (
            <div className="text-sm text-navy-600">
              Total previsto: <strong className="text-navy-800">{formatMoney(previsao.total_previsto_periodo)}</strong>
              <span className="text-navy-400 ml-1">({previsao.meses_horizonte} meses)</span>
            </div>
          )}
        </div>
        <p className="text-xs text-navy-500 mb-3">
          Agrupado pela <strong>data de chegada estimada</strong> (data emissão + lead time do fornecedor),
          considerando OCs em APROVADO, AGUARDANDO_CHEGADA, EM_TRANSITO ou RECEBIDO_PARCIAL (apenas valor ainda em aberto).
        </p>
        {!previsao?.linhas?.length ? (
          <EmptyMsg msg="Nenhuma OC com chegada prevista no horizonte" />
        ) : (
          <div className="space-y-3">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={previsao.linhas}>
                  <XAxis dataKey="mes_chegada" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => 'R$ ' + (v / 1000).toFixed(0) + 'k'} />
                  <Tooltip formatter={(v) => formatMoney(v)} />
                  <Bar dataKey="valor_total_previsto" name="Valor previsto (em aberto)" fill="#6366F1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-sm">
                <thead className="bg-surface-50 text-navy-600 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left">Mês de chegada</th>
                    <th className="px-3 py-2 text-right">Qtd OCs</th>
                    <th className="px-3 py-2 text-right">Valor previsto (aberto)</th>
                    <th className="px-3 py-2 text-right">Valor bruto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-200">
                  {previsao.linhas.map(l => (
                    <tr key={l.mes_chegada} className="hover:bg-surface-50">
                      <td className="px-3 py-2 font-mono font-medium text-navy-800">{l.mes_chegada}</td>
                      <td className="px-3 py-2 text-right text-navy-600">{l.qtd_ordens}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-navy-800">{formatMoney(l.valor_total_previsto)}</td>
                      <td className="px-3 py-2 text-right font-mono text-navy-500">{formatMoney(l.valor_total_bruto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Giro de estoque (top 8) */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-navy-600" />
          <h2 className="text-lg font-bold text-navy-800">Giro de Estoque (top 8)</h2>
        </div>
        {!giroEstoque?.length ? (
          <EmptyMsg msg="Sem dados de giro" />
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={giroEstoque.slice(0, 8)}>
                <XAxis dataKey="codigo" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="giro" name="Giro (vezes/ano)" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

const KpiCard = ({ icon: Icon, color, bg, label, value, sub }) => (
  <div className="card p-5">
    <div className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center mb-3`}>
      <Icon className={`w-5 h-5 ${color}`} />
    </div>
    <div className="text-2xl font-bold text-navy-800 leading-tight">{value || '0'}</div>
    <div className="text-sm text-navy-500 mt-1">{label}</div>
    {sub && <div className="text-xs text-navy-400 mt-1">{sub}</div>}
  </div>
);

const EmptyMsg = ({ msg }) => (
  <div className="text-center py-8 text-navy-400 text-sm">{msg}</div>
);

export default Relatorios;
