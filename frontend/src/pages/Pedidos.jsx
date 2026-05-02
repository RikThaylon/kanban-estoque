import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { formatMoney, formatDate } from '../utils/formatters';

const Pedidos = () => {
  const [page, setPage] = useState(1);
  const [statusFiltro, setStatusFiltro] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['pedidos', page, statusFiltro],
    queryFn: async () => {
      const res = await api.get('/pedidos', { params: { page, limit: 15, status: statusFiltro } });
      return res.data;
    },
  });

  const { data: sugestoes } = useQuery({
    queryKey: ['pedidos', 'sugestoes'],
    queryFn: async () => {
      const res = await api.get('/pedidos/sugestoes');
      return res.data;
    },
  });

  const getStatusStyle = (status) => {
    switch(status) {
      case 'RASCUNHO': return 'bg-gray-100 text-gray-600';
      case 'AGUARDANDO_APROVACAO': return 'bg-purple-100 text-purple-700';
      case 'APROVADO': return 'bg-blue-100 text-blue-700';
      case 'EMITIDO': return 'bg-indigo-100 text-indigo-700';
      case 'EM_TRANSITO': return 'bg-amber-100 text-amber-700';
      case 'RECEBIDO': return 'bg-green-100 text-green-700';
      case 'CANCELADO': return 'bg-red-100 text-red-700';
      default: return 'bg-surface-100 text-navy-600';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Pedidos de Compra</h1>
          <p className="text-navy-400 text-sm">Gerencie o abastecimento baseado nas sugestões Kanban</p>
        </div>
        <button className="btn-primary">
          <Plus className="w-4 h-4" /> Novo Pedido Manual
        </button>
      </div>

      {/* Sugestões de Compra (Kanban Action) */}
      <div className="card p-0 border-amber-200 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 border-b border-amber-200">
          <h2 className="text-base font-bold text-amber-800">Sugestões de Compra (Ação Kanban)</h2>
          <p className="text-xs text-amber-600 mt-1">Produtos em faixa amarela ou vermelha sugerindo reposição pelo Lote Econômico (EOQ)</p>
        </div>
        <div className="p-4 overflow-x-auto">
          {sugestoes?.length > 0 ? (
            <div className="flex gap-4 pb-2">
              {sugestoes.slice(0, 5).map(sug => (
                <div key={sug.id} className="min-w-[280px] bg-white border border-surface-200 rounded-xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
                  <div className={`absolute top-0 left-0 w-1 h-full ${sug.faixa_atual === 'VERMELHO' ? 'bg-red-500' : 'bg-amber-400'}`}></div>
                  
                  <div>
                    <div className="flex justify-between items-start mb-2 pl-2">
                      <span className="font-bold text-navy-800 truncate block max-w-[150px]">{sug.codigo}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${sug.faixa_atual === 'VERMELHO' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {sug.faixa_atual}
                      </span>
                    </div>
                    <p className="text-xs text-navy-500 mb-4 pl-2 line-clamp-2">{sug.nome}</p>
                    
                    <div className="pl-2 space-y-1 mb-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-navy-400">Sugerido (EOQ):</span>
                        <span className="font-bold text-navy-700">{sug.eoq || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-navy-400">Fornecedor:</span>
                        <span className="text-navy-700 font-medium truncate max-w-[100px]">{sug.fornecedor_nome || '-'}</span>
                      </div>
                    </div>
                  </div>

                  <button className="w-full pl-2 pr-0">
                    <div className="w-full py-2 bg-navy-50 hover:bg-navy-100 text-navy-700 font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2">
                      <Plus className="w-4 h-4" /> Gerar Pedido
                    </div>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center text-green-600">
              <CheckCircle className="w-8 h-8 mb-2 opacity-80" />
              <p className="font-medium">Nenhuma sugestão de compra no momento.</p>
              <p className="text-sm opacity-80">Todos os produtos estão na faixa verde.</p>
            </div>
          )}
        </div>
      </div>

      {/* Lista de Pedidos */}
      <div className="card p-0">
        <div className="p-4 border-b border-surface-200 flex gap-4 bg-surface-50">
          <select 
            className="input-field max-w-[200px]"
            value={statusFiltro}
            onChange={(e) => { setStatusFiltro(e.target.value); setPage(1); }}
          >
            <option value="">Todos os Status</option>
            <option value="AGUARDANDO_APROVACAO">Aguardando Aprovação</option>
            <option value="EMITIDO">Emitido</option>
            <option value="EM_TRANSITO">Em Trânsito</option>
            <option value="RECEBIDO">Recebido</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white border-b border-surface-200">
              <tr className="text-xs font-bold text-navy-400 uppercase tracking-wider">
                <th className="p-4">Número</th>
                <th className="p-4">Data Emissão</th>
                <th className="p-4">Produto</th>
                <th className="p-4">Fornecedor</th>
                <th className="p-4 text-right">Qtd</th>
                <th className="p-4 text-right">Total</th>
                <th className="p-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 bg-white">
              {isLoading ? (
                <tr><td colSpan="7" className="p-8 text-center">Carregando...</td></tr>
              ) : data?.data?.map(pedido => (
                <tr key={pedido.id} className="hover:bg-surface-50 cursor-pointer">
                  <td className="p-4 font-mono text-sm font-bold text-navy-700">{pedido.numero}</td>
                  <td className="p-4 text-sm text-navy-600">{formatDate(pedido.data_emissao)}</td>
                  <td className="p-4">
                    <div className="font-bold text-navy-800 text-sm">{pedido.produto_codigo}</div>
                    <div className="text-xs text-navy-400 truncate max-w-[150px]">{pedido.produto_nome}</div>
                  </td>
                  <td className="p-4 text-sm text-navy-600">{pedido.fornecedor_nome}</td>
                  <td className="p-4 text-right font-medium text-navy-700">
                    {pedido.quantidade_pedida}
                    {parseFloat(pedido.quantidade_recebida) > 0 && <span className="text-xs text-green-600 block">Rec: {pedido.quantidade_recebida}</span>}
                  </td>
                  <td className="p-4 text-right font-medium text-navy-700">{formatMoney(pedido.custo_total)}</td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${getStatusStyle(pedido.status)}`}>
                      {pedido.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Pedidos;
