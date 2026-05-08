import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, Download, X, Edit3, Trash2 } from 'lucide-react';
import api from '../services/api';
import FaixaBadge from '../components/kanban/FaixaBadge';
import { useAuthStore } from '../stores/authStore';
import { formatMoney, formatNumber } from '../utils/formatters';

const PERFIS_GESTAO = ['admin', 'gerente_operacoes', 'supervisor_turno'];

const Produtos = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const podeGerir = PERFIS_GESTAO.includes(user?.perfil);
  const isAdmin = user?.perfil === 'admin';
  const [page, setPage] = useState(1);
  const [busca, setBusca] = useState('');
  const [faixaFiltro, setFaixaFiltro] = useState('');
  const [openModal, setOpenModal] = useState(null); // null | 'novo' | objeto produto

  const desativar = useMutation({
    mutationFn: (id) => api.delete(`/produtos/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['produtos'] }),
  });

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-navy-800 tracking-tight">Catálogo de Produtos</h1>
          <p className="text-navy-400 text-sm mt-1">Gerencie os itens do estoque e acompanhe as faixas Kanban</p>
        </div>
        {podeGerir && (
          <button onClick={() => setOpenModal('novo')} className="btn-primary w-full sm:w-auto justify-center">
            <Plus className="w-4 h-4" /> Novo produto
          </button>
        )}
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
                        <div className="flex items-center justify-end gap-1">
                          <Link to={`/produtos/${produto.id}`} className="text-navy-500 hover:text-navy-800 font-medium text-sm px-2">
                            Detalhes
                          </Link>
                          {podeGerir && (
                            <button onClick={() => setOpenModal(produto)} className="p-1.5 text-navy-500 hover:bg-navy-50 rounded" title="Editar"><Edit3 className="w-4 h-4" /></button>
                          )}
                          {isAdmin && (
                            <button onClick={() => { if (confirm(`Desativar ${produto.codigo}?`)) desativar.mutate(produto.id); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Desativar"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </div>
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

      {openModal && <ProdutoModal produto={openModal === 'novo' ? null : openModal} onClose={() => setOpenModal(null)} />}
    </div>
  );
};

// ─── Modal: Criar/Editar Produto ───────────────────────────────────────────
const ProdutoModal = ({ produto, onClose }) => {
  const queryClient = useQueryClient();
  const isEdit = !!produto;
  const [form, setForm] = useState({
    codigo: produto?.codigo || '',
    nome: produto?.nome || '',
    descricao: produto?.descricao || '',
    unidade: produto?.unidade || 'UN',
    custo_unitario: produto?.custo_unitario || '',
    custo_pedido: produto?.custo_pedido || 100,
    taxa_carregamento: produto?.taxa_carregamento || 0.20,
    nivel_servico: produto?.nivel_servico || 95,
    localizacao: produto?.localizacao || '',
  });
  const [erro, setErro] = useState('');

  const salvar = useMutation({
    mutationFn: () => isEdit
      ? api.patch(`/produtos/${produto.id}`, {
          nome: form.nome, descricao: form.descricao, unidade: form.unidade,
          custo_unitario: parseFloat(form.custo_unitario), custo_pedido: parseFloat(form.custo_pedido),
          taxa_carregamento: parseFloat(form.taxa_carregamento), nivel_servico: parseInt(form.nivel_servico),
          localizacao: form.localizacao,
        })
      : api.post('/produtos', {
          ...form,
          custo_unitario: parseFloat(form.custo_unitario),
          custo_pedido: parseFloat(form.custo_pedido),
          taxa_carregamento: parseFloat(form.taxa_carregamento),
          nivel_servico: parseInt(form.nivel_servico),
        }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['produtos'] }); onClose(); },
    onError: (e) => setErro(e.message || 'Erro ao salvar'),
  });

  return (
    <div className="fixed inset-0 bg-navy-900/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-surface-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-navy-800">{isEdit ? `Editar produto ${produto.codigo}` : 'Novo produto'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-navy-400" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); setErro(''); salvar.mutate(); }} className="p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="label">Código</label>
              <input className="input font-mono" value={form.codigo} disabled={isEdit} onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))} required />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Nome</label>
              <input className="input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
            </div>
          </div>
          <div>
            <label className="label">Descrição</label>
            <textarea className="input resize-none" rows={2} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="label">Unidade</label>
              <select className="input" value={form.unidade} onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))}>
                {['UN','MT','KG','LT','PC','CX','PA'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Custo unit. (R$)</label>
              <input className="input font-mono" type="number" step="0.01" min="0" value={form.custo_unitario} onChange={e => setForm(f => ({ ...f, custo_unitario: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Custo pedido</label>
              <input className="input font-mono" type="number" step="0.01" min="0" value={form.custo_pedido} onChange={e => setForm(f => ({ ...f, custo_pedido: e.target.value }))} />
            </div>
            <div>
              <label className="label">Nível serviço</label>
              <select className="input" value={form.nivel_servico} onChange={e => setForm(f => ({ ...f, nivel_servico: e.target.value }))}>
                {[90, 95, 98, 99].map(n => <option key={n} value={n}>{n}%</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Taxa carregamento</label>
              <input className="input font-mono" type="number" step="0.01" min="0" max="1" value={form.taxa_carregamento} onChange={e => setForm(f => ({ ...f, taxa_carregamento: e.target.value }))} />
            </div>
            <div>
              <label className="label">Localização</label>
              <input className="input" value={form.localizacao} onChange={e => setForm(f => ({ ...f, localizacao: e.target.value }))} />
            </div>
          </div>
          {!isEdit && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-md p-3">
              Após criar, o produto entra com faixa <strong>SEM_DADOS</strong>. Conforme movimentações forem registradas e pedidos forem recebidos,
              o modelo estatístico (Holt + Regressão) calculará automaticamente CMD, ES, PR e EOQ.
            </div>
          )}
          {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3">{erro}</div>}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary justify-center">Cancelar</button>
            <button type="submit" disabled={salvar.isPending} className="btn-primary justify-center">{salvar.isPending ? 'Salvando…' : (isEdit ? 'Salvar' : 'Criar produto')}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Produtos;
