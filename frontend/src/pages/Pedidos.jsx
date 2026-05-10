import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle, X, Check, Send, PackageCheck, Clock, Eye, Ban } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { formatMoney, formatDate } from '../utils/formatters';

const STATUS_STYLES = {
  RASCUNHO: 'bg-gray-100 text-gray-700',
  AGUARDANDO_APROVACAO: 'bg-purple-100 text-purple-700',
  AGUARDANDO_GERENTE: 'bg-fuchsia-100 text-fuchsia-700',
  APROVADO: 'bg-blue-100 text-blue-700',
  EMITIDO: 'bg-indigo-100 text-indigo-700',
  EM_TRANSITO: 'bg-amber-100 text-amber-700',
  RECEBIDO_PARCIAL: 'bg-teal-100 text-teal-700',
  RECEBIDO: 'bg-green-100 text-green-700',
  CANCELADO: 'bg-red-100 text-red-700',
  REJEITADO: 'bg-rose-200 text-rose-800',
};

const PERFIS_APROVADORES_N1 = ['admin', 'supervisor_turno', 'gerente_operacoes', 'plant_manager'];
const PERFIS_APROVADORES_N2 = ['admin', 'gerente_operacoes', 'plant_manager'];

const Pedidos = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFiltro, setStatusFiltro] = useState('');
  const [openNovo, setOpenNovo] = useState(false);
  const [openReceber, setOpenReceber] = useState(null);
  const [openDetalhe, setOpenDetalhe] = useState(null);
  const [openRejeitar, setOpenRejeitar] = useState(null);
  const [pedidoTemplate, setPedidoTemplate] = useState(null);

  const isAprovadorN1 = PERFIS_APROVADORES_N1.includes(user?.perfil);

  const { data, isLoading } = useQuery({
    queryKey: ['pedidos', page, statusFiltro],
    queryFn: async () => (await api.get('/pedidos', { params: { page, limit: 15, status: statusFiltro || undefined } })).data,
  });

  const { data: sugestoes } = useQuery({
    queryKey: ['pedidos', 'sugestoes'],
    queryFn: async () => (await api.get('/pedidos/sugestoes')).data,
  });

  // Mutations
  const aprovar = useMutation({
    mutationFn: (id) => api.post(`/pedidos/${id}/aprovar`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pedidos'] }),
  });

  const emitir = useMutation({
    mutationFn: (id) => api.patch(`/pedidos/${id}/status`, { status: 'EMITIDO' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pedidos'] }),
  });

  const cancelar = useMutation({
    mutationFn: (id) => api.patch(`/pedidos/${id}/status`, { status: 'CANCELADO' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pedidos'] }),
  });

  const rejeitar = useMutation({
    mutationFn: ({ id, motivo }) => api.post(`/pedidos/${id}/rejeitar`, { motivo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      setOpenRejeitar(null);
    },
  });

  const handleGerarSugestao = (sug) => {
    setPedidoTemplate({
      produto_id: sug.id,
      produto_codigo: sug.codigo,
      produto_nome: sug.nome,
      fornecedor_id: sug.fornecedor_id,
      fornecedor_nome: sug.fornecedor_nome,
      quantidade_pedida: sug.eoq || 0,
      preco_unitario: sug.preco_acordado || sug.custo_unitario || 0,
    });
    setOpenNovo(true);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-navy-800">Pedidos de Compra</h1>
          <p className="text-navy-400 text-sm">Abastecimento baseado nas sugestões Kanban</p>
        </div>
        <button onClick={() => { setPedidoTemplate(null); setOpenNovo(true); }} className="btn-primary w-full sm:w-auto justify-center">
          <Plus className="w-4 h-4" /> Novo Pedido
        </button>
      </div>

      {/* Sugestões de Compra */}
      <div className="card p-0 border-amber-200 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 border-b border-amber-200">
          <h2 className="text-base font-bold text-amber-800">Sugestões de Compra (Ação Kanban)</h2>
          <p className="text-xs text-amber-600 mt-1">Produtos em faixa amarela ou vermelha — clique em Gerar Pedido pra emitir baseado no EOQ</p>
        </div>
        <div className="p-4 overflow-x-auto">
          {sugestoes?.length > 0 ? (
            <div className="flex gap-4 pb-2">
              {sugestoes.slice(0, 8).map(sug => (
                <div key={sug.id} className="min-w-[280px] max-w-[280px] bg-white border border-surface-200 rounded-xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
                  <div className={`absolute top-0 left-0 w-1 h-full ${sug.faixa_atual === 'VERMELHO' ? 'bg-red-500' : 'bg-amber-400'}`}></div>
                  <div>
                    <div className="flex justify-between items-start mb-2 pl-2 gap-2">
                      <span className="font-bold text-navy-800 truncate flex-1">{sug.codigo}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${sug.faixa_atual === 'VERMELHO' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {sug.faixa_atual}
                      </span>
                    </div>
                    <p className="text-xs text-navy-500 mb-3 pl-2 line-clamp-2">{sug.nome}</p>
                    <div className="pl-2 space-y-1 mb-4 text-sm">
                      <Row label="Sugerido (EOQ):" value={sug.eoq || 0} />
                      <Row label="Cobertura:" value={sug.dias_cobertura !== null ? `${sug.dias_cobertura} dias` : '—'} />
                      <Row label="Fornecedor:" value={sug.fornecedor_nome || '—'} clamp />
                    </div>
                  </div>
                  <button
                    onClick={() => handleGerarSugestao(sug)}
                    disabled={!sug.fornecedor_id || !sug.eoq}
                    className="w-full py-2 bg-navy-50 hover:bg-navy-100 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed text-navy-700 font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                    title={!sug.fornecedor_id ? 'Sem fornecedor padrão cadastrado' : !sug.eoq ? 'Sem EOQ calculado' : ''}
                  >
                    <Plus className="w-4 h-4" /> Gerar Pedido
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
        <div className="p-4 border-b border-surface-200 flex flex-wrap gap-3 bg-surface-50">
          <select
            className="input"
            value={statusFiltro}
            onChange={(e) => { setStatusFiltro(e.target.value); setPage(1); }}
          >
            <option value="">Todos os status</option>
            <option value="RASCUNHO">Rascunho</option>
            <option value="AGUARDANDO_APROVACAO">Aguardando aprovação</option>
            <option value="APROVADO">Aprovado</option>
            <option value="EMITIDO">Emitido</option>
            <option value="EM_TRANSITO">Em trânsito</option>
            <option value="RECEBIDO_PARCIAL">Recebido parcial</option>
            <option value="RECEBIDO">Recebido</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
        </div>

        {/* Desktop: tabela */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white border-b border-surface-200">
              <tr className="text-xs font-bold text-navy-400 uppercase tracking-wider">
                <th className="p-4">Número</th>
                <th className="p-4">Data</th>
                <th className="p-4">Produto</th>
                <th className="p-4">Fornecedor</th>
                <th className="p-4 text-right">Qtd</th>
                <th className="p-4 text-right">Total</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 bg-white">
              {isLoading && <tr><td colSpan="8" className="p-8 text-center">Carregando...</td></tr>}
              {!isLoading && data?.data?.length === 0 && <tr><td colSpan="8" className="p-8 text-center text-navy-400">Nenhum pedido encontrado.</td></tr>}
              {!isLoading && data?.data?.map(pedido => (
                <tr key={pedido.id} className="hover:bg-surface-50">
                  <td className="p-4 font-mono text-sm font-bold text-navy-700">{pedido.numero}</td>
                  <td className="p-4 text-sm text-navy-600">{formatDate(pedido.data_emissao || pedido.criado_em)}</td>
                  <td className="p-4">
                    <div className="font-bold text-navy-800 text-sm">{pedido.produto_codigo}</div>
                    <div className="text-xs text-navy-400 truncate max-w-[200px]">{pedido.produto_nome}</div>
                  </td>
                  <td className="p-4 text-sm text-navy-600 truncate max-w-[150px]">{pedido.fornecedor_nome}</td>
                  <td className="p-4 text-right font-medium text-navy-700 whitespace-nowrap">
                    {pedido.quantidade_pedida}
                    {parseFloat(pedido.quantidade_recebida) > 0 && <span className="text-xs text-green-600 block">Rec: {pedido.quantidade_recebida}</span>}
                  </td>
                  <td className="p-4 text-right font-medium text-navy-700">{formatMoney(pedido.custo_total)}</td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${STATUS_STYLES[pedido.status] || 'bg-surface-100'}`}>
                      {pedido.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="p-4">
                    <PedidoActions
                      pedido={pedido}
                      onAprovar={() => aprovar.mutate(pedido.id)}
                      onEmitir={() => emitir.mutate(pedido.id)}
                      onReceber={() => setOpenReceber(pedido)}
                      onCancelar={() => { if (confirm('Cancelar este pedido?')) cancelar.mutate(pedido.id); }}
                      onDetalhe={() => setOpenDetalhe(pedido)}
                      isAprovador={isAprovadorN1}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: cards */}
        <div className="md:hidden divide-y divide-surface-100">
          {isLoading && <div className="p-8 text-center">Carregando...</div>}
          {!isLoading && data?.data?.length === 0 && <div className="p-8 text-center text-navy-400">Nenhum pedido encontrado.</div>}
          {!isLoading && data?.data?.map(pedido => (
            <div key={pedido.id} className="p-4 space-y-2">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <div className="font-mono font-bold text-navy-700 text-sm">{pedido.numero}</div>
                  <div className="text-xs text-navy-500">{formatDate(pedido.data_emissao || pedido.criado_em)}</div>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${STATUS_STYLES[pedido.status] || 'bg-surface-100'} shrink-0`}>
                  {pedido.status.replace(/_/g, ' ')}
                </span>
              </div>
              <div>
                <div className="text-sm font-semibold text-navy-800">{pedido.produto_codigo} — {pedido.produto_nome}</div>
                <div className="text-xs text-navy-500">{pedido.fornecedor_nome}</div>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-navy-600">Qtd: <strong>{pedido.quantidade_pedida}</strong></span>
                <span className="font-semibold text-navy-800">{formatMoney(pedido.custo_total)}</span>
              </div>
              <PedidoActions
                pedido={pedido}
                onAprovar={() => aprovar.mutate(pedido.id)}
                onRejeitar={() => setOpenRejeitar(pedido)}
                onEmitir={() => emitir.mutate(pedido.id)}
                onReceber={() => setOpenReceber(pedido)}
                onCancelar={() => { if (confirm('Cancelar este pedido?')) cancelar.mutate(pedido.id); }}
                onDetalhe={() => setOpenDetalhe(pedido)}
                isAprovador={isAprovadorN1}
              />
            </div>
          ))}
        </div>

        {/* Paginação */}
        {data && data.totalPages > 1 && (
          <div className="p-4 border-t border-surface-200 flex items-center justify-between text-sm">
            <span className="text-navy-500">Página {data.page} de {data.totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary disabled:opacity-40">Anterior</button>
              <button disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)} className="btn-secondary disabled:opacity-40">Próxima</button>
            </div>
          </div>
        )}
      </div>

      {openNovo && <NovoPedidoModal template={pedidoTemplate} onClose={() => { setOpenNovo(false); setPedidoTemplate(null); }} />}
      {openReceber && <ReceberPedidoModal pedido={openReceber} onClose={() => setOpenReceber(null)} />}
      {openDetalhe && <DetalhePedidoModal pedido={openDetalhe} onClose={() => setOpenDetalhe(null)} />}
      {openRejeitar && <RejeitarPedidoModal pedido={openRejeitar} onClose={() => setOpenRejeitar(null)} onConfirm={(motivo) => rejeitar.mutate({ id: openRejeitar.id, motivo })} loading={rejeitar.isPending} />}
    </div>
  );
};

const Row = ({ label, value, clamp }) => (
  <div className="flex justify-between gap-2">
    <span className="text-navy-400 shrink-0">{label}</span>
    <span className={`font-medium text-navy-700 ${clamp ? 'truncate' : ''}`}>{value}</span>
  </div>
);

// ─── Ações por pedido ───────────────────────────────────────────────────────
const PedidoActions = ({ pedido, onAprovar, onRejeitar, onEmitir, onReceber, onCancelar, onDetalhe, isAprovador }) => {
  const aguardando = ['AGUARDANDO_APROVACAO', 'AGUARDANDO_GERENTE'].includes(pedido.status);
  const podeAprovar = aguardando && isAprovador;
  const podeRejeitar = aguardando && isAprovador;
  const podeEmitir = pedido.status === 'APROVADO' || pedido.status === 'RASCUNHO';
  const podeReceber = ['EMITIDO', 'EM_TRANSITO', 'RECEBIDO_PARCIAL'].includes(pedido.status);
  const podeCancelar = !['RECEBIDO', 'CANCELADO', 'REJEITADO'].includes(pedido.status);

  return (
    <div className="flex flex-wrap items-center gap-1.5 justify-center">
      <button onClick={onDetalhe} className="p-1.5 text-navy-500 hover:bg-navy-50 rounded transition-colors" title="Ver detalhes">
        <Eye className="w-4 h-4" />
      </button>
      {podeAprovar && (
        <button onClick={onAprovar} className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors" title="Aprovar">
          <Check className="w-4 h-4" />
        </button>
      )}
      {podeRejeitar && (
        <button onClick={onRejeitar} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition-colors" title="Rejeitar">
          <Ban className="w-4 h-4" />
        </button>
      )}
      {podeEmitir && (
        <button onClick={onEmitir} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Emitir">
          <Send className="w-4 h-4" />
        </button>
      )}
      {podeReceber && (
        <button onClick={onReceber} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Receber">
          <PackageCheck className="w-4 h-4" />
        </button>
      )}
      {podeCancelar && (
        <button onClick={onCancelar} className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors" title="Cancelar">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// ─── Modal: Rejeitar Pedido ─────────────────────────────────────────────────
const RejeitarPedidoModal = ({ pedido, onClose, onConfirm, loading }) => {
  const [motivo, setMotivo] = useState('');
  return (
    <div className="fixed inset-0 bg-navy-900/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b border-surface-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-rose-700">Rejeitar pedido</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-navy-400" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (motivo.trim().length < 5) return; onConfirm(motivo.trim()); }} className="p-5 space-y-3">
          <div className="text-sm text-navy-600 bg-surface-50 rounded-md p-3">
            <div><strong>{pedido.numero}</strong> · {pedido.produto_codigo} — {pedido.produto_nome}</div>
            <div className="text-xs">Status: {pedido.status} · Total: {formatMoney(pedido.custo_total)}</div>
          </div>
          <div>
            <label className="label">Motivo da rejeição</label>
            <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3} required minLength={5} maxLength={1000}
              placeholder="Explique o motivo (mínimo 5 caracteres)..." className="input resize-none" autoFocus />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary justify-center">Cancelar</button>
            <button type="submit" disabled={loading || motivo.trim().length < 5} className="btn-danger justify-center">
              {loading ? 'Rejeitando…' : 'Confirmar rejeição'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Modal: Novo Pedido ─────────────────────────────────────────────────────
const NovoPedidoModal = ({ template, onClose }) => {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState(template?.produto_codigo ? `${template.produto_codigo} — ${template.produto_nome}` : '');
  const [produtoId, setProdutoId] = useState(template?.produto_id || '');
  const [fornecedorId, setFornecedorId] = useState(template?.fornecedor_id || '');
  const [quantidade, setQuantidade] = useState(template?.quantidade_pedida || '');
  const [precoUnit, setPrecoUnit] = useState(template?.preco_unitario || '');
  const [dataPrevista, setDataPrevista] = useState('');
  const [erro, setErro] = useState('');

  const { data: produtosRes } = useQuery({
    queryKey: ['produtos', 'busca', busca],
    queryFn: async () => (await api.get('/produtos', { params: { limit: 20, busca } })).data,
    enabled: busca.length >= 2 && !produtoId,
  });

  const { data: fornecedores } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: async () => {
      try {
        return (await api.get('/fornecedores')).data;
      } catch {
        return null; // endpoint pode não existir; cai no fallback abaixo
      }
    },
  });

  // Fallback: se não tiver endpoint de fornecedores, usa sugestões pra obter lista
  const fornecedoresLista = useMemo(() => {
    if (Array.isArray(fornecedores)) return fornecedores;
    if (fornecedores?.data) return fornecedores.data;
    return [];
  }, [fornecedores]);

  const total = useMemo(() => {
    const q = parseFloat(quantidade) || 0;
    const p = parseFloat(precoUnit) || 0;
    return q * p;
  }, [quantidade, precoUnit]);

  const criar = useMutation({
    mutationFn: () => api.post('/pedidos', {
      produto_id: produtoId,
      fornecedor_id: fornecedorId,
      quantidade_pedida: parseFloat(quantidade),
      preco_unitario: precoUnit ? parseFloat(precoUnit) : undefined,
      data_prevista: dataPrevista || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      onClose();
    },
    onError: (e) => setErro(e.message || 'Erro ao criar pedido'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setErro('');
    if (!produtoId) return setErro('Selecione um produto');
    if (!fornecedorId) return setErro('Selecione um fornecedor');
    if (!quantidade || parseFloat(quantidade) <= 0) return setErro('Quantidade deve ser > 0');
    criar.mutate();
  };

  return (
    <div className="fixed inset-0 bg-navy-900/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-surface-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-navy-800">{template ? 'Gerar pedido a partir da sugestão' : 'Novo pedido de compra'}</h2>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Produto */}
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1">Produto</label>
            <input
              type="text"
              value={busca}
              onChange={e => { setBusca(e.target.value); setProdutoId(''); }}
              placeholder="Digite código ou nome..."
              className="input w-full"
              disabled={!!template}
              autoFocus={!template}
            />
            {busca.length >= 2 && !produtoId && produtosRes?.data?.length > 0 && (
              <div className="mt-1 max-h-40 overflow-y-auto border border-surface-200 rounded-md bg-white shadow-sm">
                {produtosRes.data.map(p => (
                  <button
                    key={p.id} type="button"
                    onClick={() => {
                      setProdutoId(p.id);
                      setBusca(`${p.codigo} — ${p.nome}`);
                      // Auto-preenche o preço unitário com o custo cadastrado no produto
                      if (p.custo_unitario && !precoUnit) {
                        setPrecoUnit(parseFloat(p.custo_unitario));
                      }
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-surface-50 text-sm border-b border-surface-100 last:border-0"
                  >
                    <span className="font-medium text-navy-800">{p.codigo}</span>
                    <span className="text-navy-500 ml-2">{p.nome}</span>
                    {p.custo_unitario && <span className="text-navy-400 ml-2 text-xs">R$ {parseFloat(p.custo_unitario).toFixed(2)}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fornecedor */}
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1">Fornecedor</label>
            {fornecedoresLista.length > 0 ? (
              <select value={fornecedorId} onChange={e => setFornecedorId(e.target.value)} className="input w-full" required>
                <option value="">Selecione...</option>
                {fornecedoresLista.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            ) : (
              <input
                type="text"
                value={fornecedorId}
                onChange={e => setFornecedorId(e.target.value)}
                placeholder={template?.fornecedor_nome || 'UUID do fornecedor (sem endpoint disponível)'}
                className="input w-full font-mono text-xs"
                required
              />
            )}
            {template?.fornecedor_nome && (
              <p className="text-xs text-navy-500 mt-1">Sugerido: {template.fornecedor_nome}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-navy-700 mb-1">Quantidade</label>
              <input type="number" step="0.0001" min="0" value={quantidade}
                onChange={e => setQuantidade(e.target.value)} className="input w-full font-mono" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-700 mb-1">Preço unitário (R$)</label>
              <input type="number" step="0.01" min="0" value={precoUnit}
                onChange={e => setPrecoUnit(e.target.value)} className="input w-full font-mono" />
            </div>
          </div>

          {total > 0 && (
            <div className="bg-surface-50 border border-surface-200 rounded-md px-3 py-2 text-sm flex justify-between">
              <span className="text-navy-500">Total:</span>
              <strong className="text-navy-800">{formatMoney(total)}</strong>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1">Data prevista (opcional)</label>
            <input type="date" value={dataPrevista} onChange={e => setDataPrevista(e.target.value)} className="input w-full" />
          </div>

          {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3">{erro}</div>}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary justify-center">Cancelar</button>
            <button type="submit" disabled={criar.isPending} className="btn-primary justify-center">
              {criar.isPending ? 'Criando…' : 'Criar pedido'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Modal: Receber Pedido ──────────────────────────────────────────────────
const ReceberPedidoModal = ({ pedido, onClose }) => {
  const queryClient = useQueryClient();
  const restante = parseFloat(pedido.quantidade_pedida) - parseFloat(pedido.quantidade_recebida || 0);
  const [quantidade, setQuantidade] = useState(restante);
  const [numeroNF, setNumeroNF] = useState('');
  const [erro, setErro] = useState('');

  const receber = useMutation({
    mutationFn: () => api.post(`/pedidos/${pedido.id}/receber`, {
      quantidade_recebida: parseFloat(quantidade),
      numero_nf: numeroNF || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['movimentacoes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
    onError: (e) => setErro(e.message || 'Erro ao receber pedido'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setErro('');
    if (!quantidade || parseFloat(quantidade) <= 0) return setErro('Quantidade deve ser > 0');
    receber.mutate();
  };

  return (
    <div className="fixed inset-0 bg-navy-900/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b border-surface-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy-800">Receber pedido</h2>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="text-sm text-navy-600 bg-surface-50 rounded-md p-3 space-y-1">
            <div><strong>{pedido.numero}</strong> · {pedido.produto_codigo} — {pedido.produto_nome}</div>
            <div className="text-xs">Qtd pedida: {pedido.quantidade_pedida} · Já recebido: {pedido.quantidade_recebida || 0} · Restante: <strong>{restante}</strong></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1">Quantidade recebida agora</label>
            <input type="number" step="0.0001" min="0" max={restante}
              value={quantidade} onChange={e => setQuantidade(e.target.value)}
              className="input w-full font-mono" required autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1">Nº da NF (opcional)</label>
            <input type="text" value={numeroNF} onChange={e => setNumeroNF(e.target.value)} className="input w-full" />
          </div>
          {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3">{erro}</div>}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary justify-center">Cancelar</button>
            <button type="submit" disabled={receber.isPending} className="btn-primary justify-center">
              {receber.isPending ? 'Registrando…' : 'Confirmar recebimento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Modal: Detalhe do Pedido ───────────────────────────────────────────────
const DetalhePedidoModal = ({ pedido, onClose }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['pedidos', pedido.id, 'detalhe'],
    queryFn: async () => (await api.get(`/pedidos/${pedido.id}`)).data,
  });
  const p = data || pedido;

  return (
    <div className="fixed inset-0 bg-navy-900/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-surface-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-navy-800">Detalhe do pedido</h2>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3 text-sm">
          {isLoading ? <div className="text-navy-400">Carregando…</div> : (
            <>
              <DetailRow label="Número" value={<span className="font-mono">{p.numero}</span>} />
              <DetailRow label="Status" value={<span className={`px-2 py-0.5 rounded text-xs font-bold ${STATUS_STYLES[p.status]}`}>{p.status.replace(/_/g, ' ')}</span>} />
              <DetailRow label="Produto" value={`${p.produto_codigo} — ${p.produto_nome}`} />
              <DetailRow label="Fornecedor" value={p.fornecedor_nome} />
              {p.fornecedor_cnpj && <DetailRow label="CNPJ" value={p.fornecedor_cnpj} />}
              {p.departamento_nome && <DetailRow label="Departamento" value={`${p.departamento_codigo} — ${p.departamento_nome}`} />}
              {p.motivo_rejeicao && <DetailRow label="Motivo rejeição" value={<span className="text-rose-700">{p.motivo_rejeicao}</span>} />}
              {p.rejeitado_por_nome && <DetailRow label="Rejeitado por" value={p.rejeitado_por_nome} />}
              <DetailRow label="Quantidade" value={p.quantidade_pedida} />
              <DetailRow label="Quantidade recebida" value={p.quantidade_recebida || 0} />
              <DetailRow label="Preço unitário" value={p.preco_unitario ? formatMoney(p.preco_unitario) : '—'} />
              <DetailRow label="Custo total" value={formatMoney(p.custo_total)} />
              <DetailRow label="Faixa no momento" value={p.faixa_no_momento || '—'} />
              <DetailRow label="Estoque no momento" value={p.estoque_no_momento ?? '—'} />
              <DetailRow label="PR no momento" value={p.pr_no_momento ?? '—'} />
              <DetailRow label="Data emissão" value={p.data_emissao ? formatDate(p.data_emissao) : '—'} />
              <DetailRow label="Data prevista" value={p.data_prevista ? formatDate(p.data_prevista) : '—'} />
              <DetailRow label="Data recebimento" value={p.data_recebimento ? formatDate(p.data_recebimento) : '—'} />
              <DetailRow label="Lead time real" value={p.lead_time_real_dias ? `${p.lead_time_real_dias} dias` : '—'} />
              <DetailRow label="Criado por" value={p.criado_por_nome || '—'} />
              {p.aprovado_por_nome && <DetailRow label="Aprovado por" value={p.aprovado_por_nome} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const DetailRow = ({ label, value }) => (
  <div className="flex justify-between gap-4 py-1.5 border-b border-surface-100 last:border-0">
    <span className="text-navy-500 shrink-0">{label}</span>
    <span className="text-navy-800 text-right break-words">{value}</span>
  </div>
);

export default Pedidos;
