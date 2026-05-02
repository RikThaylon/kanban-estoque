import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, Download } from 'lucide-react';
import api from '../services/api';
import FaixaBadge from '../components/kanban/FaixaBadge';
import { formatMoney, formatNumber } from '../utils/formatters';

const Produtos = () => {
  const [page, setPage] = useState(1);
  const [busca, setBusca] = useState('');
  const [faixaFiltro, setFaixaFiltro] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['produtos', page, busca, faixaFiltro],
    queryFn: async () => {
      const res = await api.get('/produtos', {
        params: { page, limit: 10, busca, faixa: faixaFiltro }
      });
      return res.data;
    },
    keepPreviousData: true,
  });

  const exportCSV = () => {
    if (!data?.data) return;
    const header = 'Codigo,Nome,Estoque,Faixa,PR,Custo\n';
    const csv = data.data.map(p => 
      `${p.codigo},"${p.nome}",${p.estoque_atual},${p.faixa_atual || 'SEM_DADOS'},${p.ponto_reposicao || 0},${p.custo_unitario}`
    ).join('\n');
    
    const blob = new Blob([header + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'produtos_kanban.csv';
    link.click();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-800 tracking-tight">Catálogo de Produtos</h1>
          <p className="text-navy-400 text-sm mt-1">Gerencie os itens do estoque e acompanhe as faixas Kanban</p>
        </div>
        <button className="btn-primary">
          <Plus className="w-4 h-4" /> Novo Produto
        </button>
      </div>

      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
            <input
              type="text"
              placeholder="Buscar por código ou nome..."
              className="input-field pl-10"
              value={busca}
              onChange={e => { setBusca(e.target.value); setPage(1); }}
            />
          </div>
          
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-navy-400" />
            <select 
              className="input-field w-40"
              value={faixaFiltro}
              onChange={e => { setFaixaFiltro(e.target.value); setPage(1); }}
            >
              <option value="">Todas as Faixas</option>
              <option value="VERMELHO">Vermelho (Crítico)</option>
              <option value="AMARELO">Amarelo (Atenção)</option>
              <option value="VERDE">Verde (Normal)</option>
              <option value="SEM_DADOS">Sem Dados</option>
            </select>
          </div>

          <button onClick={exportCSV} className="btn-secondary whitespace-nowrap">
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-surface-200 text-xs font-bold text-navy-400 uppercase tracking-wider">
                <th className="p-4">Código</th>
                <th className="p-4">Produto</th>
                <th className="p-4 text-right">Estoque</th>
                <th className="p-4 text-center">Faixa Kanban</th>
                <th className="p-4 text-right">PR</th>
                <th className="p-4 text-right">Custo Un.</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-navy-400">Carregando...</td>
                </tr>
              ) : data?.data?.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-navy-400">Nenhum produto encontrado.</td>
                </tr>
              ) : (
                data?.data.map((produto) => {
                  let rowColor = '';
                  if (produto.faixa_atual === 'VERMELHO') rowColor = 'bg-red-50/30';
                  else if (produto.faixa_atual === 'AMARELO') rowColor = 'bg-amber-50/30';

                  return (
                    <tr key={produto.id} className={`hover:bg-surface-50 transition-colors ${rowColor}`}>
                      <td className="p-4 font-mono text-sm text-navy-700">{produto.codigo}</td>
                      <td className="p-4">
                        <div className="font-bold text-navy-800">{produto.nome}</div>
                        <div className="text-xs text-navy-400">{produto.categoria_nome}</div>
                      </td>
                      <td className="p-4 text-right font-bold text-navy-700">
                        {formatNumber(produto.estoque_atual)} {produto.unidade}
                      </td>
                      <td className="p-4 text-center">
                        <FaixaBadge faixa={produto.faixa_atual} />
                      </td>
                      <td className="p-4 text-right text-navy-600 font-medium">
                        {formatNumber(produto.ponto_reposicao) || '-'}
                      </td>
                      <td className="p-4 text-right text-navy-600">
                        {formatMoney(produto.custo_unitario)}
                      </td>
                      <td className="p-4 text-right">
                        <Link to={`/produtos/${produto.id}`} className="text-navy-500 hover:text-navy-800 font-medium text-sm">
                          Detalhes
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 px-4">
            <span className="text-sm text-navy-500">
              Página <span className="font-bold">{data.page}</span> de <span className="font-bold">{data.totalPages}</span>
            </span>
            <div className="flex gap-2">
              <button 
                className="btn-secondary"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                Anterior
              </button>
              <button 
                className="btn-secondary"
                disabled={page === data.totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Produtos;
