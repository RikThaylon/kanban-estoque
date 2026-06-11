import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, AlertTriangle, AlertCircle, CheckCircle, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import ConsumptionChart from '../components/charts/ConsumptionChart';
import { formatMoney, formatNumber, formatDate } from '../utils/formatters';

const Dashboard = () => {
  // Fetch Resumo KPIs
  const { data: resumo, isLoading: loadResumo } = useQuery({
    queryKey: ['dashboard', 'resumo'],
    queryFn: async () => {
      const res = await api.get('/dashboard/resumo');
      return res.data;
    },
    refetchInterval: 30000,
  });

  // Fetch Consumo Semanal
  const { data: consumo, isLoading: loadConsumo } = useQuery({
    queryKey: ['dashboard', 'consumo-semanal'],
    queryFn: async () => {
      const res = await api.get('/dashboard/consumo-semanal');
      // Agrupar por semana
      const byWeek = {};
      res.data.forEach(item => {
        if (!byWeek[item.semana]) {
          byWeek[item.semana] = { semana: item.semana, consumo: 0 };
        }
        byWeek[item.semana].consumo += parseFloat(item.consumo);
      });
      return Object.values(byWeek).sort((a, b) => new Date(a.semana) - new Date(b.semana));
    },
    refetchInterval: 60000,
  });

  // Fetch Pedidos Vencidos
  const { data: pedidosRes } = useQuery({
    queryKey: ['pedidos', 'vencidos'],
    queryFn: async () => {
      const res = await api.get('/pedidos', { params: { limit: 5 } });
      return res.data.data.filter(p => 
        ['AGUARDANDO_CHEGADA', 'EMITIDO', 'EM_TRANSITO'].includes(p.status) && 
        new Date(p.data_prevista) < new Date()
      );
    },
    refetchInterval: 60000,
  });

  if (loadResumo) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-white rounded-xl"></div>)}
        </div>
        <div className="h-96 bg-white rounded-xl"></div>
      </div>
    );
  }

  const kpis = [
    { title: 'Total de Produtos', value: formatNumber(resumo?.total_produtos), icon: Package, color: 'text-navy-600', bg: 'bg-navy-100', link: '/produtos' },
    { title: 'Estoque Crítico', value: formatNumber(resumo?.por_faixa?.vermelho), icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100', link: '/produtos?faixa=VERMELHO' },
    { title: 'Atenção (Reposição)', value: formatNumber(resumo?.por_faixa?.amarelo), icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-100', link: '/produtos?faixa=AMARELO' },
    { title: 'Estoque Normal', value: formatNumber(resumo?.por_faixa?.verde), icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', link: '/produtos?faixa=VERDE' },
  ];

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      <div className="page-intro">
        <div>
          <p className="page-kicker">Centro de comando</p>
          <h1 className="text-2xl sm:text-3xl font-black text-steel-900">Dashboard Kanban</h1>
          <p className="text-steel-500 text-sm mt-1">Visao geral do sistema de controle de estoque</p>
        </div>
        <div className="metric-card px-4 py-3 text-sm font-bold text-steel-700 w-full sm:w-auto">
          <span className="text-steel-500">Valor em estoque</span>
          <span className="block text-xl text-steel-950">{formatMoney(resumo?.valor_estoque_total)}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
          <Link key={idx} to={kpi.link} className="metric-card p-5 hover:border-steel-400 transition-colors group">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 rounded-md flex items-center justify-center ${kpi.bg}`}>
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
              <ArrowRight className="w-4 h-4 text-steel-300 group-hover:text-steel-700 transition-colors" />
            </div>
            <h3 className="text-3xl font-black text-steel-950 leading-none mb-1">{kpi.value}</h3>
            <p className="text-sm text-steel-500 font-bold">{kpi.title}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico Consumo */}
        <div className="card p-5 lg:col-span-2 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-navy-800">Consumo Agregado (Últimas Semanas)</h2>
          </div>
          <div className="flex-1 min-h-[250px]">
            {loadConsumo ? (
              <div className="w-full h-full bg-surface-50 animate-pulse rounded-lg"></div>
            ) : (
              <ConsumptionChart data={consumo} />
            )}
          </div>
        </div>

        {/* Alertas e Pedidos */}
        <div className="space-y-6">
          {/* Rupturas Iminentes */}
          <div className="card p-0 overflow-hidden flex flex-col h-[250px]">
            <div className="p-4 border-b border-surface-200 bg-red-50/50">
              <h2 className="text-base font-bold text-red-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Risco de Ruptura ({resumo?.ruptura_iminente_7d?.length || 0})
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {resumo?.ruptura_iminente_7d?.length > 0 ? (
                <div className="space-y-2">
                  {resumo.ruptura_iminente_7d.slice(0, 5).map(item => (
                    <Link key={item.id} to={`/produtos/${item.id}`} className="block p-3 bg-white border border-surface-200 rounded-lg hover:bg-surface-50 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm font-bold text-navy-800 truncate">{item.codigo}</span>
                        <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">{item.dias_cobertura}d</span>
                      </div>
                      <p className="text-xs text-navy-500 truncate">{item.nome}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-navy-400 p-4 text-center">
                  <CheckCircle className="w-8 h-8 text-green-400 mb-2" />
                  <p className="text-sm">Nenhum risco de ruptura iminente detectado.</p>
                </div>
              )}
            </div>
          </div>

          {/* Pedidos Vencidos */}
          <div className="card p-0 overflow-hidden">
            <div className="p-4 border-b border-surface-200">
              <h2 className="text-base font-bold text-amber-800 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Pedidos Vencidos
              </h2>
            </div>
            <div className="p-0">
              {pedidosRes?.length > 0 ? (
                <div className="divide-y divide-surface-200">
                  {pedidosRes.map(pedido => (
                    <Link key={pedido.id} to={`/pedidos/${pedido.id}`} className="block p-4 hover:bg-surface-50 transition-colors">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-bold text-navy-700">{pedido.numero}</span>
                        <span className="text-xs font-medium text-red-600">
                          {formatDate(pedido.data_prevista)}
                        </span>
                      </div>
                      <p className="text-xs text-navy-500 truncate">{pedido.produto_nome}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-navy-400">
                  <p className="text-sm">Nenhum pedido atrasado.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
