import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ClipboardList, Plus, CheckCircle, X, Check, Send, PackageCheck, Eye, Ban } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores/uiStore';
import { formatMoney, formatDate } from '../utils/formatters';
import { isReadOnlyPerfil } from '../utils/permissoes';
import { STATUS_STYLES, statusLabel } from '../utils/pedidosStatus';
import { invalidateOperationalData } from '../utils/queryInvalidation';

const APROVADORES_PADRAO = {
  nivel1: ['supervisor_turno'],
  nivel2: ['gerente_operacoes'],
  nivel3: ['plant_manager'],
};
const PERFIS_SEM_APROVACAO_COMPRA = ['comprador', 'facilitador', 'visualizador'];
const PERFIS_SEM_FLUXO_COMPRA = ['visualizador'];
const filtrarPerfisAprovadores = (perfis) => perfis.filter((perfil) => !PERFIS_SEM_APROVACAO_COMPRA.includes(perfil));
const normalizarNivelAprovador = (perfis, fallback) => (
  [...new Set(['admin', ...filtrarPerfisAprovadores(Array.isArray(perfis) ? perfis : fallback)])]
);
const normalizarEtapaFluxo = (perfis, fallback) => (
  [...new Set(['admin', ...(Array.isArray(perfis) ? perfis : fallback).filter((perfil) => !PERFIS_SEM_FLUXO_COMPRA.includes(perfil))])]
);

const normalizarFluxoCompra = (config) => ({
  solicitantes: normalizarEtapaFluxo(config?.solicitantes, ['facilitador', 'comprador']),
  aprovadores: {
    nivel1: normalizarNivelAprovador(config?.aprovadores_nivel_1, APROVADORES_PADRAO.nivel1),
    nivel2: normalizarNivelAprovador(config?.aprovadores_nivel_2, APROVADORES_PADRAO.nivel2),
    nivel3: normalizarNivelAprovador(config?.aprovadores_nivel_3, APROVADORES_PADRAO.nivel3),
  },
  compradores: normalizarEtapaFluxo(config?.compradores, ['comprador']),
  recebedores: normalizarEtapaFluxo(config?.recebedores, ['comprador', 'facilitador']),
});

const Pedidos = () => {
  const { user } = useAuthStore();
  const pushToast = useUiStore(state => state.pushToast);
  const readOnly = isReadOnlyPerfil(user?.perfil);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFiltro, setStatusFiltro] = useState('');
  const [openNovo, setOpenNovo] = useState(false);
  const [openReceber, setOpenReceber] = useState(null);
  const [openDetalhe, setOpenDetalhe] = useState(null);
  const [openRejeitar, setOpenRejeitar] = useState(null);
  const [openEmitir, setOpenEmitir] = useState(null);
  const [pedidoTemplate, setPedidoTemplate] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['pedidos', page, statusFiltro],
    queryFn: async () => (await api.get('/pedidos', { params: { page, limit: 15, status: statusFiltro || undefined } })).data,
  });

  const { data: configPedidos } = useQuery({
    queryKey: ['configuracoes', 'pedidos'],
    queryFn: async () => (await api.get('/configuracoes/pedidos')).data,
  });

  const fluxoCompra = useMemo(() => normalizarFluxoCompra(configPedidos), [configPedidos]);
  const podeSolicitarCompra = !readOnly && fluxoCompra.solicitantes.includes(user?.perfil);

  const { data: sugestoes } = useQuery({
    queryKey: ['pedidos', 'sugestoes'],
    queryFn: async () => (await api.get('/pedidos/sugestoes')).data,
  });

  // Mutations
  const aprovar = useMutation({
    mutationFn: (id) => api.post(`/pedidos/${id}/aprovar`),
    onSuccess: (res) => {
      invalidateOperationalData(queryClient, res.data?.produto_id);
      pushToast({
        tipo: res.data?.status === 'APROVADO' ? 'success' : 'info',
        titulo: `Pedido ${res.data?.numero || ''}`.trim(),
        mensagem: res.data?.status === 'APROVADO'
          ? 'Aprovacao interna concluida. O comprador deve registrar fornecedor e numero da OC externa.'
          : `Escalado para ${statusLabel(res.data?.status).toLowerCase()}.`,
      });
    },
  });

  const emitir = useMutation({
    mutationFn: ({ id, numero_oc_externa, fornecedor_id }) => api.patch(`/pedidos/${id}/status`, {
      status: 'AGUARDANDO_CHEGADA',
      numero_oc_externa,
      fornecedor_id,
    }),
    onSuccess: (res) => {
      invalidateOperationalData(queryClient, res.data?.produto_id);
      pushToast({ tipo: 'success', titulo: 'OC externa registrada', mensagem: 'Pedido aguardando chegada para lancamento da NF.' });
      setOpenEmitir(null);
    },
  });

  const cancelar = useMutation({
    mutationFn: (id) => api.patch(`/pedidos/${id}/status`, { status: 'CANCELADO' }),
    onSuccess: (res) => {
      invalidateOperationalData(queryClient, res.data?.produto_id);
      pushToast({ tipo: 'warning', titulo: 'Pedido cancelado', mensagem: 'A fila de compras foi atualizada.' });
    },
  });

  const rejeitar = useMutation({
    mutationFn: ({ id, motivo }) => api.post(`/pedidos/${id}/rejeitar`, { motivo }),
    onSuccess: (res) => {
      invalidateOperationalData(queryClient, res.data?.produto_id);
      pushToast({ tipo: 'warning', titulo: 'Pedido rejeitado', mensagem: 'O solicitante verá o retorno na fila de pedidos.' });
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
          <p className="text-navy-400 text-sm">Solicitacao, aprovacao, OC externa, chegada e NF</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Link to="/pedidos/acompanhar" className="btn-secondary w-full sm:w-auto justify-center">
            <ClipboardList className="w-4 h-4" /> Acompanhar Pedido
          </Link>
          {podeSolicitarCompra && (
            <button onClick={() => { setPedidoTemplate(null); setOpenNovo(true); }} className="btn-primary w-full sm:w-auto justify-center">
              <Plus className="w-4 h-4" /> Novo Pedido
            </button>
          )}
        </div>
      </div>

      <div className="rounded-md border border-surface-200 bg-white px-4 py-3 text-sm text-navy-600 flex flex-wrap items-center gap-2">
        <span className="font-semibold text-navy-800">Fluxo:</span>
        <span>Solicitacao</span>
        <span className="text-navy-300">-&gt;</span>
        <span>Aprovacao supervisor/gerente</span>
        <span className="text-navy-300">-&gt;</span>
        <span>Comprador registra OC</span>
        <span className="text-navy-300">-&gt;</span>
        <span>Aguardando chegada</span>
        <span className="text-navy-300">-&gt;</span>
        <span>NF e conclusao</span>
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
                    disabled={!podeSolicitarCompra || !sug.fornecedor_id || !sug.eoq}
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
            <option value="AGUARDANDO_APROVACAO">Aguardando aprovação (Nível 1)</option>
            <option value="AGUARDANDO_GERENTE">Aguardando gerente (Nível 2)</option>
            <option value="AGUARDANDO_DIRETORIA">Aguardando diretoria (Nível 3)</option>
            <option value="APROVADO">Aprovado internamente / aguardando comprador</option>
            <option value="AGUARDANDO_CHEGADA">Aguardando chegada</option>
            <option value="EMITIDO">Aguardando chegada (legado)</option>
            <option value="EM_TRANSITO">Em trânsito</option>
            <option value="RECEBIDO_PARCIAL">Recebido parcial</option>
            <option value="CONCLUIDO">Concluido</option>
            <option value="RECEBIDO">Concluido (legado)</option>
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
                <th className="p-4">Maquina</th>
                <th className="p-4">Fornecedor</th>
                <th className="p-4 text-right">Qtd</th>
                <th className="p-4 text-right">Total</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 bg-white">
              {isLoading && <tr><td colSpan="9" className="p-8 text-center">Carregando...</td></tr>}
              {!isLoading && data?.data?.length === 0 && <tr><td colSpan="9" className="p-8 text-center text-navy-400">Nenhum pedido encontrado.</td></tr>}
              {!isLoading && data?.data?.map(pedido => (
                <tr key={pedido.id} className="hover:bg-surface-50">
                  <td className="p-4 font-mono text-sm font-bold text-navy-700">{pedido.numero}</td>
                  <td className="p-4 text-sm text-navy-600">{formatDate(pedido.data_emissao || pedido.criado_em)}</td>
                  <td className="p-4">
                    <div className="font-bold text-navy-800 text-sm">{pedido.produto_codigo}</div>
                    <div className="text-xs text-navy-400 truncate max-w-[200px]">{pedido.produto_nome}</div>
                  </td>
                  <td className="p-4 text-sm text-navy-600">
                    {pedido.maquina_codigo ? (
                      <div className="max-w-[160px]">
                        <div className="font-mono font-medium text-navy-700">{pedido.maquina_codigo}</div>
                        <div className="text-xs text-navy-400 truncate">{pedido.departamento_nome || pedido.maquina_nome}</div>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="p-4 text-sm text-navy-600 truncate max-w-[150px]">{pedido.fornecedor_nome}</td>
                  <td className="p-4 text-right font-medium text-navy-700 whitespace-nowrap">
                    {pedido.quantidade_pedida}
                    {parseFloat(pedido.quantidade_recebida) > 0 && <span className="text-xs text-green-600 block">Rec: {pedido.quantidade_recebida}</span>}
                  </td>
                  <td className="p-4 text-right font-medium text-navy-700">{formatMoney(pedido.custo_total)}</td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${STATUS_STYLES[pedido.status] || 'bg-surface-100'}`}>
                      {statusLabel(pedido.status)}
                    </span>
                  </td>
                  <td className="p-4">
                      <PedidoActions
                        pedido={pedido}
                        user={user}
                        fluxo={fluxoCompra}
                        onAprovar={() => aprovar.mutate(pedido.id)}
                        onEmitir={() => setOpenEmitir(pedido)}
                        onReceber={() => setOpenReceber(pedido)}
                        onCancelar={() => { if (confirm('Cancelar este pedido?')) cancelar.mutate(pedido.id); }}
                        onDetalhe={() => setOpenDetalhe(pedido)}
                        onRejeitar={() => setOpenRejeitar(pedido)}
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
                  {statusLabel(pedido.status)}
                </span>
              </div>
              <div>
                <div className="text-sm font-semibold text-navy-800">{pedido.produto_codigo} — {pedido.produto_nome}</div>
                <div className="text-xs text-navy-500">{pedido.fornecedor_nome}</div>
                {pedido.maquina_codigo && (
                  <div className="text-xs text-navy-500">
                    {pedido.maquina_codigo} - {pedido.departamento_nome || pedido.maquina_nome}
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-navy-600">Qtd: <strong>{pedido.quantidade_pedida}</strong></span>
                <span className="font-semibold text-navy-800">{formatMoney(pedido.custo_total)}</span>
              </div>
              <PedidoActions
                pedido={pedido}
                user={user}
                fluxo={fluxoCompra}
                onAprovar={() => aprovar.mutate(pedido.id)}
                onRejeitar={() => setOpenRejeitar(pedido)}
                onEmitir={() => setOpenEmitir(pedido)}
                onReceber={() => setOpenReceber(pedido)}
                onCancelar={() => { if (confirm('Cancelar este pedido?')) cancelar.mutate(pedido.id); }}
                onDetalhe={() => setOpenDetalhe(pedido)}
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

      {openNovo && <NovoPedidoModal template={pedidoTemplate} fluxo={fluxoCompra} onClose={() => { setOpenNovo(false); setPedidoTemplate(null); }} />}
      {openReceber && <ReceberPedidoModal pedido={openReceber} onClose={() => setOpenReceber(null)} />}
      {openDetalhe && <DetalhePedidoModal pedido={openDetalhe} onClose={() => setOpenDetalhe(null)} />}
      {openEmitir && <EmitirPedidoModal pedido={openEmitir} onClose={() => setOpenEmitir(null)} onConfirm={(payload) => emitir.mutate(payload)} loading={emitir.isPending} />}
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
const PedidoActions = ({ pedido, user, fluxo, onAprovar, onRejeitar, onEmitir, onReceber, onCancelar, onDetalhe }) => {
  const aprovadores = fluxo?.aprovadores || {};
  const podeAprovarN1 = aprovadores?.nivel1?.includes(user?.perfil);
  const podeAprovarN2 = aprovadores?.nivel2?.includes(user?.perfil);
  const podeAprovarN3 = aprovadores?.nivel3?.includes(user?.perfil);
  const podeComprar = fluxo?.compradores?.includes(user?.perfil);
  const podeRegistrarRecebimento = fluxo?.recebedores?.includes(user?.perfil);
  const readOnly = isReadOnlyPerfil(user?.perfil);
  const pedidoDoUsuario = pedido.criado_por && pedido.criado_por === user?.id;

  let podeAprovar = false;
  if (pedido.status === 'AGUARDANDO_APROVACAO') {
    podeAprovar = podeAprovarN1
      && (user?.perfil !== 'supervisor_turno' || !pedido.aprovador_n1_id || pedido.aprovador_n1_id === user?.id);
  }
  else if (pedido.status === 'AGUARDANDO_GERENTE') podeAprovar = podeAprovarN2;
  else if (pedido.status === 'AGUARDANDO_DIRETORIA') podeAprovar = podeAprovarN3;

  podeAprovar = !readOnly && podeAprovar && (!pedidoDoUsuario || user?.perfil === 'admin');
  const podeRejeitar = podeAprovar;
  const podeEmitir = !readOnly && pedido.status === 'APROVADO' && podeComprar;
  const podeReceber = !readOnly && podeRegistrarRecebimento && ['AGUARDANDO_CHEGADA', 'EMITIDO', 'EM_TRANSITO', 'RECEBIDO_PARCIAL'].includes(pedido.status);
  const podeCancelar = !readOnly && !['CONCLUIDO', 'RECEBIDO', 'CANCELADO', 'REJEITADO'].includes(pedido.status);

  return (
    <div className="flex flex-wrap items-center gap-1.5 justify-center">
      <button onClick={onDetalhe} className="p-1.5 text-navy-500 hover:bg-navy-50 rounded transition-colors" title="Ver detalhes">
        <Eye className="w-4 h-4" />
      </button>
      {podeAprovar && (
        <button onClick={onAprovar} className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors" title="Aprovar internamente">
          <Check className="w-4 h-4" />
        </button>
      )}
      {podeRejeitar && (
        <button onClick={onRejeitar} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition-colors" title="Rejeitar">
          <Ban className="w-4 h-4" />
        </button>
      )}
      {podeEmitir && (
        <button onClick={onEmitir} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Registrar OC externa">
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
const NovoPedidoModal = ({ template, fluxo, onClose }) => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const pushToast = useUiStore(state => state.pushToast);
  const podeEscolherFornecedor = fluxo?.compradores?.includes(user?.perfil);
  const [busca, setBusca] = useState(template?.produto_codigo ? `${template.produto_codigo} — ${template.produto_nome}` : '');
  const [produtoId, setProdutoId] = useState(template?.produto_id || '');
  const [fornecedorId, setFornecedorId] = useState(template?.fornecedor_id || '');
  const [quantidade, setQuantidade] = useState(template?.quantidade_pedida || '');
  const [precoUnit, setPrecoUnit] = useState(template?.preco_unitario || '');
  const [dataPrevista, setDataPrevista] = useState('');
  const [maquinaId, setMaquinaId] = useState('');
  const [erro, setErro] = useState('');

  const { data: produtosRes } = useQuery({
    queryKey: ['produtos', 'busca', busca],
    queryFn: async () => (await api.get('/produtos', { params: { limit: 20, busca } })).data,
    enabled: busca.length >= 2 && !produtoId,
  });

  const { data: maquinasProduto, isLoading: carregandoMaquinas } = useQuery({
    queryKey: ['maquinas', 'produto', produtoId],
    queryFn: async () => (await api.get('/maquinas', { params: { produto_id: produtoId } })).data,
    enabled: !!produtoId,
  });

  useEffect(() => {
    if (!produtoId) {
      setMaquinaId('');
      return;
    }

    const maquinas = maquinasProduto || [];
    if (maquinas.length === 1) {
      setMaquinaId(maquinas[0].id);
      return;
    }
    if (maquinaId && !maquinas.some((m) => m.id === maquinaId)) {
      setMaquinaId('');
    }
  }, [produtoId, maquinasProduto, maquinaId]);

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
      fornecedor_id: podeEscolherFornecedor ? (fornecedorId || undefined) : undefined,
      quantidade_pedida: parseFloat(quantidade),
      preco_unitario: precoUnit ? parseFloat(precoUnit) : undefined,
      data_prevista: dataPrevista || undefined,
      maquina_id: maquinaId || undefined,
    }),
    onSuccess: (res) => {
      invalidateOperationalData(queryClient, res.data?.produto_id);
      const status = res.data?.status || '';
      pushToast({
        tipo: 'success',
        titulo: `Pedido ${res.data?.numero || ''}`.trim(),
        mensagem: status === 'AGUARDANDO_APROVACAO'
          ? 'Solicitacao enviada para aprovacao do supervisor.'
          : status === 'AGUARDANDO_GERENTE'
            ? 'Solicitacao enviada para aprovacao do gerente de operacoes.'
            : status === 'AGUARDANDO_DIRETORIA'
              ? 'Solicitacao enviada para aprovacao da diretoria.'
              : 'Pedido criado e encaminhado no fluxo de compras.',
      });
      onClose();
    },
    onError: (e) => setErro(e.message || 'Erro ao criar pedido'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setErro('');
    if (!produtoId) return setErro('Selecione um produto');
    if (carregandoMaquinas) return setErro('Aguarde carregar as maquinas vinculadas');
    if ((maquinasProduto || []).length === 0) return setErro('Produto sem maquina vinculada. Vincule o item em Maquinas antes de solicitar compra.');
    if (!maquinaId) return setErro('Selecione a maquina que precisa de reposicao');
    if (podeEscolherFornecedor && !fornecedorId) return setErro('Selecione um fornecedor');
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
              onChange={e => { setBusca(e.target.value); setProdutoId(''); setMaquinaId(''); }}
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
                      setMaquinaId('');
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

          {produtoId && (
            <div>
              <label className="block text-sm font-medium text-navy-700 mb-1">Maquina solicitante</label>
              {carregandoMaquinas ? (
                <div className="input w-full text-navy-400">Carregando maquinas...</div>
              ) : (maquinasProduto || []).length > 0 ? (
                <select value={maquinaId} onChange={e => setMaquinaId(e.target.value)} className="input w-full" required>
                  <option value="">Selecione...</option>
                  {(maquinasProduto || []).map(m => (
                    <option key={m.id} value={m.id}>
                      {m.codigo} - {m.nome}{m.departamento_nome ? ` - ${m.departamento_nome}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-md p-3">
                  Produto sem maquina vinculada. Cadastre o vinculo em Maquinas antes de criar a solicitacao.
                </div>
              )}
              {(maquinasProduto || []).length > 1 && (
                <p className="text-xs text-navy-500 mt-1">Este item e usado em N maquinas; escolha a maquina correta para rotear o aprovador.</p>
              )}
            </div>
          )}

          {/* Fornecedor */}
          {podeEscolherFornecedor && (
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
              <p className="text-xs text-navy-500 mt-1">Sugerido: {template.fornecedor_nome} por menor LT</p>
            )}
          </div>
          )}

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
const EmitirPedidoModal = ({ pedido, onClose, onConfirm, loading }) => {
  const [numeroOc, setNumeroOc] = useState(pedido.numero_oc_externa || '');
  const [fornecedorId, setFornecedorId] = useState(pedido.fornecedor_id || '');
  const [erro, setErro] = useState('');

  const { data: fornecedores } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: async () => (await api.get('/fornecedores')).data,
  });

  const fornecedoresLista = useMemo(() => {
    if (Array.isArray(fornecedores)) return fornecedores;
    if (fornecedores?.data) return fornecedores.data;
    return [];
  }, [fornecedores]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setErro('');
    if (!fornecedorId) return setErro('Selecione o fornecedor escolhido pelo comprador');
    if (!numeroOc.trim()) return setErro('Informe o numero da OC externa');
    onConfirm({ id: pedido.id, fornecedor_id: fornecedorId, numero_oc_externa: numeroOc.trim() });
  };

  return (
    <div className="fixed inset-0 bg-navy-900/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b border-surface-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy-800">Registrar OC externa</h2>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="text-sm text-indigo-800 bg-indigo-50 border border-indigo-100 rounded-md p-3">
            Pedido ja aprovado internamente. O comprador deve escolher o fornecedor e informar o numero da OC criada no sistema externo.
          </div>
          <div className="text-sm text-navy-600 bg-surface-50 rounded-md p-3">
            <strong>{pedido.numero}</strong> - {pedido.produto_codigo} - {pedido.produto_nome}
          </div>
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1">Fornecedor escolhido</label>
            <select value={fornecedorId} onChange={e => setFornecedorId(e.target.value)} className="input w-full" required>
              <option value="">Selecione...</option>
              {fornecedoresLista.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1">Numero da OC externa</label>
            <input value={numeroOc} onChange={e => setNumeroOc(e.target.value)} className="input w-full font-mono" required autoFocus />
          </div>
          {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3">{erro}</div>}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary justify-center">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary justify-center">
              {loading ? 'Registrando...' : 'Registrar OC externa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ReceberPedidoModal = ({ pedido, onClose }) => {
  const queryClient = useQueryClient();
  const pushToast = useUiStore(state => state.pushToast);
  const restante = parseFloat(pedido.quantidade_pedida) - parseFloat(pedido.quantidade_recebida || 0);
  const [quantidade, setQuantidade] = useState(restante);
  const [numeroNF, setNumeroNF] = useState('');
  const [erro, setErro] = useState('');

  const receber = useMutation({
    mutationFn: () => api.post(`/pedidos/${pedido.id}/receber`, {
      quantidade_recebida: parseFloat(quantidade),
      numero_nf: numeroNF.trim(),
    }),
    onSuccess: () => {
      invalidateOperationalData(queryClient, pedido.produto_id);
      pushToast({
        tipo: 'success',
        titulo: 'Recebimento registrado',
        mensagem: 'Estoque atualizado e Kanban recalculando em segundo plano.',
      });
      onClose();
    },
    onError: (e) => setErro(e.message || 'Erro ao receber pedido'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setErro('');
    if (!quantidade || parseFloat(quantidade) <= 0) return setErro('Quantidade deve ser > 0');
    if (!numeroNF.trim()) return setErro('Informe o numero da NF');
    receber.mutate();
  };

  return (
    <div className="fixed inset-0 bg-navy-900/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b border-surface-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy-800">Registrar NF e concluir</h2>
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
            <label className="block text-sm font-medium text-navy-700 mb-1">Numero da NF</label>
            <input type="text" value={numeroNF} onChange={e => setNumeroNF(e.target.value)} className="input w-full" required />
          </div>
          {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3">{erro}</div>}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary justify-center">Cancelar</button>
            <button type="submit" disabled={receber.isPending} className="btn-primary justify-center">
              {receber.isPending ? 'Registrando...' : 'Concluir pedido'}
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
              <DetailRow label="Status" value={<span className={`px-2 py-0.5 rounded text-xs font-bold ${STATUS_STYLES[p.status]}`}>{statusLabel(p.status)}</span>} />
              {p.numero_oc_externa && <DetailRow label="OC externa registrada" value={<span className="font-mono">{p.numero_oc_externa}</span>} />}
              <DetailRow label="Produto" value={`${p.produto_codigo} — ${p.produto_nome}`} />
              <DetailRow label="Fornecedor" value={p.fornecedor_nome} />
              {p.fornecedor_cnpj && <DetailRow label="CNPJ" value={p.fornecedor_cnpj} />}
              {p.maquina_codigo && <DetailRow label="Maquina" value={`${p.maquina_codigo} - ${p.maquina_nome}`} />}
              {p.departamento_nome && <DetailRow label="Departamento" value={`${p.departamento_codigo} — ${p.departamento_nome}`} />}
              {p.aprovador_n1_nome && <DetailRow label="Supervisor responsavel" value={p.aprovador_n1_nome} />}
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
              {p.aprovado_por_nome && <DetailRow label="Aprovado internamente por" value={p.aprovado_por_nome} />}
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
