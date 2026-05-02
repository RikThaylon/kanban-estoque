import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Edit, AlertCircle } from 'lucide-react';
import api from '../services/api';
import KanbanBar from '../components/kanban/KanbanBar';
import FaixaBadge from '../components/kanban/FaixaBadge';
import FormulaCard from '../components/kanban/FormulaCard';
import ConsumptionChart from '../components/charts/ConsumptionChart';
import { formatMoney, formatNumber } from '../utils/formatters';

const ProdutoDetalhe = () => {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('kanban');

  const { data: produto, isLoading } = useQuery({
    queryKey: ['produto', id],
    queryFn: async () => {
      const res = await api.get(`/produtos/${id}`);
      return res.data;
    },
  });

  const { data: rastreamento } = useQuery({
    queryKey: ['produto', id, 'rastreamento'],
    queryFn: async () => {
      const res = await api.get(`/produtos/${id}/rastreamento-calculo`);
      return res.data;
    },
    enabled: !!produto && activeTab === 'rastreamento',
  });

  if (isLoading) return <div className="p-8 text-center animate-pulse">Carregando detalhes do produto...</div>;
  if (!produto) return <div className="p-8 text-center text-red-500">Produto não encontrado.</div>;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <Link to="/produtos" className="p-2 rounded-lg hover:bg-surface-200 text-navy-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-navy-800">{produto.nome}</h1>
            <FaixaBadge faixa={produto.faixa_atual} />
          </div>
          <p className="text-navy-400 text-sm font-mono mt-1">CÓD: {produto.codigo} | CAT: {produto.categoria_nome}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary">Lançar Movimentação</button>
          <button className="btn-primary">Emitir Pedido</button>
        </div>
      </div>

      {/* Main Info Card */}
      <div className="card p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-surface-50 p-4 rounded-xl border border-surface-200">
            <p className="text-sm text-navy-500 font-medium mb-1">Estoque Atual</p>
            <div className="text-3xl font-bold text-navy-800">{formatNumber(produto.estoque_atual)} <span className="text-base font-normal text-navy-400">{produto.unidade}</span></div>
          </div>
          <div>
            <p className="text-sm text-navy-500 font-medium mb-1">Custo Unitário</p>
            <div className="text-xl font-bold text-navy-700">{formatMoney(produto.custo_unitario)}</div>
          </div>
          <div>
            <p className="text-sm text-navy-500 font-medium mb-1">Classificação ABC</p>
            <div className="text-xl font-bold text-navy-700">Curva {produto.classificacao_abc || '-'}</div>
          </div>
          <div>
            <p className="text-sm text-navy-500 font-medium mb-1">Localização</p>
            <div className="text-xl font-bold text-navy-700">{produto.localizacao || 'Não definida'}</div>
          </div>
        </div>

        <div className="mb-4">
          <h3 className="text-sm font-bold text-navy-800 mb-4 uppercase tracking-wider">Régua Kanban</h3>
          <KanbanBar 
            estoqueAtual={parseFloat(produto.estoque_atual)}
            es={parseFloat(produto.estoque_seguranca || 0)}
            pr={parseFloat(produto.ponto_reposicao || 0)}
            emax={parseFloat(produto.estoque_maximo || 0)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-surface-200">
        <nav className="flex gap-6">
          {['kanban', 'rastreamento', 'movimentacoes', 'pedidos'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-1 text-sm font-bold capitalize border-b-2 transition-colors ${
                activeTab === tab 
                  ? 'border-navy-700 text-navy-800' 
                  : 'border-transparent text-navy-400 hover:text-navy-600 hover:border-surface-300'
              }`}
            >
              {tab === 'rastreamento' ? 'Rastreamento Matemático' : tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="pt-2">
        {activeTab === 'kanban' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <FormulaCard 
              title="Estoque de Segurança (ES)"
              value={formatNumber(produto.estoque_seguranca)}
              formula={`Z × σd × √(LT)`}
              tooltip={`Z(${produto.nivel_servico}%) = ${parseFloat(produto.fator_z).toFixed(2)}, Sigma D = ${parseFloat(produto.sigma_demanda_diaria).toFixed(2)}`}
            />
            <FormulaCard 
              title="Ponto de Reposição (PR)"
              value={formatNumber(produto.ponto_reposicao)}
              formula={`(D × LT) + ES`}
              tooltip={`Demanda diária = ${parseFloat(produto.demanda_diaria_media).toFixed(2)}, Lead time previsto = ${parseFloat(produto.lead_time_previsto_dias).toFixed(1)} dias`}
            />
            <FormulaCard 
              title="Lote Econômico (EOQ)"
              value={formatNumber(produto.eoq)}
              formula={`√((2 × D × Cp) / H)`}
              tooltip={`Cp = ${formatMoney(produto.custo_pedido)}, H (custo manter) = ${(parseFloat(produto.taxa_carregamento)*100).toFixed(0)}%`}
            />
            <FormulaCard 
              title="Estoque Máximo (Emax)"
              value={formatNumber(produto.estoque_maximo)}
              formula={`ES + EOQ`}
            />
          </div>
        )}

        {activeTab === 'rastreamento' && rastreamento && (
          <div className="space-y-6">
            <div className="card p-5 bg-surface-50 border-dashed">
              <h3 className="font-bold text-navy-800 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-navy-400" />
                Auditoria de Cálculos Preditivos
              </h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-bold text-navy-600 mb-2 border-b border-surface-200 pb-2">Suavização Exponencial Dupla de Holt (Demanda)</h4>
                  <ul className="text-sm text-navy-700 space-y-2 font-mono bg-white p-4 rounded border border-surface-200">
                    <li>α (Nível) = {rastreamento.holt_outputs.alpha}</li>
                    <li>β (Tendência) = {rastreamento.holt_outputs.beta}</li>
                    <li>Previsão Semana (F_t+1) = {rastreamento.holt_outputs.forecast.toFixed(4)}</li>
                    <li>Desvio Padrão (σ_res) = {rastreamento.holt_outputs.sigma.toFixed(4)}</li>
                    <li className="pt-2 mt-2 border-t border-surface-100 font-bold text-navy-800">
                      Demanda Diária Média = {(rastreamento.holt_outputs.forecast / 7).toFixed(4)}
                    </li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="text-sm font-bold text-navy-600 mb-2 border-b border-surface-200 pb-2">Regressão Linear (Lead Time)</h4>
                  <ul className="text-sm text-navy-700 space-y-2 font-mono bg-white p-4 rounded border border-surface-200">
                    <li>Intercepto (a) = {rastreamento.regressao_outputs.intercepto.toFixed(4)}</li>
                    <li>Inclinação (b) = {rastreamento.regressao_outputs.inclinacao.toFixed(4)}</li>
                    <li>R² = {rastreamento.regressao_outputs.r2.toFixed(4)}</li>
                    <li>Desvio Padrão (σ_LT) = {rastreamento.regressao_outputs.sigma.toFixed(4)}</li>
                    <li className="pt-2 mt-2 border-t border-surface-100 font-bold text-navy-800">
                      LT Previsto = {rastreamento.regressao_outputs.previsao.toFixed(4)} dias
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'movimentacoes' && (
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-surface-50 border-b border-surface-200">
                <tr className="text-xs font-bold text-navy-500 uppercase tracking-wider">
                  <th className="p-4">Data</th>
                  <th className="p-4">Tipo</th>
                  <th className="p-4 text-right">Qtd</th>
                  <th className="p-4 text-right">Estoque Após</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {produto.ultimas_movimentacoes?.length > 0 ? (
                  produto.ultimas_movimentacoes.map(m => (
                    <tr key={m.id} className="hover:bg-surface-50">
                      <td className="p-4 text-sm text-navy-600">{new Date(m.criado_em).toLocaleDateString('pt-BR')}</td>
                      <td className="p-4">
                        <span className={`text-xs font-bold px-2 py-1 rounded ${
                          ['ENTRADA', 'AJUSTE_POSITIVO', 'DEVOLUCAO'].includes(m.tipo) 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {m.tipo}
                        </span>
                      </td>
                      <td className="p-4 text-sm font-bold text-navy-700 text-right">{formatNumber(m.quantidade)}</td>
                      <td className="p-4 text-sm text-navy-600 text-right">{formatNumber(m.estoque_depois)}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="4" className="p-8 text-center text-navy-400">Nenhuma movimentação</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProdutoDetalhe;
