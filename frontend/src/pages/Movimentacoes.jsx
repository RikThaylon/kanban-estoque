import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDownCircle, ArrowUpCircle, Edit3, Plus, Check, X, Clock, AlertCircle, FileText } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { formatNumber, formatDateTime } from '../utils/formatters';
import { isReadOnlyPerfil } from '../utils/permissoes';
import { invalidateOperationalData } from '../utils/queryInvalidation';

const TIPOS = [
  { value: 'ENTRADA', label: 'Entrada', icon: ArrowDownCircle, color: 'text-green-600', bg: 'bg-green-50' },
  { value: 'SAIDA', label: 'Saída', icon: ArrowUpCircle, color: 'text-red-600', bg: 'bg-red-50' },
  { value: 'AJUSTE_POSITIVO', label: 'Ajuste +', icon: Edit3, color: 'text-blue-600', bg: 'bg-blue-50' },
  { value: 'AJUSTE_NEGATIVO', label: 'Ajuste −', icon: Edit3, color: 'text-orange-600', bg: 'bg-orange-50' },
  { value: 'DEVOLUCAO', label: 'Devolução', icon: ArrowDownCircle, color: 'text-teal-600', bg: 'bg-teal-50' },
];

const TURNOS_LEGADO = {
  TURNO_A: 'Turno A',
  TURNO_B: 'Turno B',
  TURNO_C: 'Turno C',
  ADMINISTRATIVO: 'Administrativo',
};

const formatTurno = (valor, turnos = []) => {
  if (!valor) return '—';
  const turno = turnos.find((t) => t.id === valor);
  return turno ? `${turno.nome} (${turno.inicio}-${turno.fim})` : (TURNOS_LEGADO[valor] || valor);
};

const STATUS_BADGE = {
  PENDENTE: 'bg-amber-100 text-amber-800',
  APROVADO: 'bg-blue-100 text-blue-800',
  EXECUTADO: 'bg-green-100 text-green-800',
  REJEITADO: 'bg-red-100 text-red-800',
};

const PERFIS_APROVADORES = ['admin', 'supervisor_turno', 'gerente_operacoes', 'plant_manager'];

const Movimentacoes = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAprovador = PERFIS_APROVADORES.includes(user?.perfil);
  const readOnly = isReadOnlyPerfil(user?.perfil);
  const { data: turnosData } = useQuery({
    queryKey: ['configuracoes', 'turnos'],
    queryFn: async () => (await api.get('/configuracoes/turnos')).data,
  });
  const turnos = turnosData?.turnos || [];

  const [tab, setTab] = useState('todas'); // 'todas' | 'pendentes'
  const [filterTipo, setFilterTipo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [openNova, setOpenNova] = useState(false);
  const [openRejeitar, setOpenRejeitar] = useState(null);

  // Lista geral de movimentações
  const { data: movs, isLoading } = useQuery({
    queryKey: ['movimentacoes', { filterTipo, filterStatus }],
    queryFn: async () => {
      const params = { limit: 100 };
      if (filterTipo) params.tipo = filterTipo;
      if (filterStatus) params.status = filterStatus;
      const res = await api.get('/movimentacoes', { params });
      return res.data;
    },
    enabled: tab === 'todas',
  });

  // Lista de pendências
  const { data: pendentes } = useQuery({
    queryKey: ['movimentacoes', 'pendentes'],
    queryFn: async () => (await api.get('/movimentacoes/pendentes')).data,
    refetchInterval: 30000,
  });

  // Aprovar
  const aprovar = useMutation({
    mutationFn: (id) => api.post(`/movimentacoes/${id}/aprovar`),
    onSuccess: () => {
      invalidateOperationalData(queryClient);
    },
  });

  // Rejeitar
  const rejeitar = useMutation({
    mutationFn: ({ id, motivo }) => api.post(`/movimentacoes/${id}/rejeitar`, { motivo }),
    onSuccess: () => {
      invalidateOperationalData(queryClient);
      setOpenRejeitar(null);
    },
  });

  const lista = tab === 'pendentes' ? (pendentes || []) : (movs?.data || []);

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-800 tracking-tight">Movimentações de Estoque</h1>
          <p className="text-navy-400 text-sm mt-1">Entradas, saídas e ajustes de estoque</p>
        </div>
        {!readOnly && (
          <button onClick={() => setOpenNova(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nova movimentação
          </button>
        )}
      </div>

      <div className="rounded-lg border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-navy-600">
        <strong className="text-navy-800">Fluxo:</strong> entradas e saídas executadas atualizam o estoque na hora.
        Ajustes, devoluções e transferências ficam pendentes quando exigem aprovação; só alteram o saldo depois da aprovação.
        Recebimento de compra também entra como movimentação de entrada.
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-surface-200">
        <button
          onClick={() => setTab('todas')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${tab === 'todas' ? 'border-navy-600 text-navy-700' : 'border-transparent text-navy-400 hover:text-navy-600'}`}
        >
          Todas
        </button>
        <button
          onClick={() => setTab('pendentes')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${tab === 'pendentes' ? 'border-amber-500 text-amber-700' : 'border-transparent text-navy-400 hover:text-navy-600'}`}
        >
          <Clock className="w-4 h-4" />
          Aguardando aprovação
          {pendentes?.length > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-800 rounded-full">{pendentes.length}</span>
          )}
        </button>
      </div>

      {/* Filtros (somente na aba "todas") */}
      {tab === 'todas' && (
        <div className="flex flex-wrap gap-3">
          <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className="input">
            <option value="">Todos os tipos</option>
            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input">
            <option value="">Todos os status</option>
            <option value="PENDENTE">Pendente</option>
            <option value="EXECUTADO">Executado</option>
            <option value="REJEITADO">Rejeitado</option>
          </select>
        </div>
      )}

      {/* Tabela */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-sm">
            <thead className="bg-surface-50 text-navy-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Produto</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Turno</th>
                <th className="px-4 py-3 text-right">Quantidade</th>
                <th className="px-4 py-3 text-right">Estoque (antes → depois)</th>
                <th className="px-4 py-3 text-left">Por</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200">
              {isLoading && tab === 'todas' && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-navy-400">Carregando…</td></tr>
              )}
              {!isLoading && lista.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-navy-400">
                  {tab === 'pendentes' ? 'Nada aguardando aprovação. 🎉' : 'Nenhuma movimentação encontrada.'}
                </td></tr>
              )}
              {lista.map(m => {
                const tipoConf = TIPOS.find(t => t.value === m.tipo);
                const Icon = tipoConf?.icon || FileText;
                return (
                  <tr key={m.id} className="hover:bg-surface-50/60 transition-colors">
                    <td className="px-4 py-3 text-navy-600 whitespace-nowrap">{formatDateTime(m.criado_em)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-navy-800">{m.produto_codigo}</div>
                      <div className="text-xs text-navy-500 truncate max-w-xs">{m.produto_nome}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${tipoConf?.bg} ${tipoConf?.color}`}>
                        <Icon className="w-3 h-3" /> {tipoConf?.label || m.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-navy-500 whitespace-nowrap">
                      {formatTurno(m.turno, turnos)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{formatNumber(m.quantidade)} {m.unidade}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-navy-500">
                      {formatNumber(m.estoque_antes)} → <span className="text-navy-800 font-medium">{formatNumber(m.estoque_depois)}</span>
                    </td>
                    <td className="px-4 py-3 text-navy-600">
                      <div>{m.criado_por_nome || '—'}</div>
                      {m.criado_por_username && <div className="text-xs text-navy-400">@{m.criado_por_username}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[m.status] || 'bg-gray-100 text-gray-800'}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {m.status === 'PENDENTE' && isAprovador && !readOnly && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => aprovar.mutate(m.id)}
                            disabled={aprovar.isPending}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Aprovar"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setOpenRejeitar(m)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Rejeitar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      {m.status === 'REJEITADO' && m.motivo_rejeicao && (
                        <span title={m.motivo_rejeicao} className="text-xs text-red-600 cursor-help inline-flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Ver motivo
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nova Movimentação */}
      {openNova && <NovaMovimentacaoModal onClose={() => setOpenNova(false)} />}

      {/* Modal Rejeitar */}
      {openRejeitar && (
        <RejeitarModal
          movimentacao={openRejeitar}
          onClose={() => setOpenRejeitar(null)}
          onConfirm={(motivo) => rejeitar.mutate({ id: openRejeitar.id, motivo })}
          loading={rejeitar.isPending}
        />
      )}
    </div>
  );
};

// ─── Modal: Nova Movimentação ───────────────────────────────────────────────
const NovaMovimentacaoModal = ({ onClose }) => {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [produtoId, setProdutoId] = useState('');
  const [tipo, setTipo] = useState('SAIDA');
  const [turno, setTurno] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [referencia, setReferencia] = useState('');
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const { data: turnosData, isLoading: carregandoTurnos } = useQuery({
    queryKey: ['configuracoes', 'turnos'],
    queryFn: async () => (await api.get('/configuracoes/turnos')).data,
  });
  const turnos = turnosData?.turnos || [];

  const { data: produtosRes } = useQuery({
    queryKey: ['produtos', 'busca', busca],
    queryFn: async () => {
      const res = await api.get('/produtos', { params: { limit: 20, busca } });
      return res.data;
    },
    enabled: busca.length >= 2,
  });

  const requerAprovacao = useMemo(
    () => ['AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'DEVOLUCAO'].includes(tipo),
    [tipo]
  );

  const criar = useMutation({
    mutationFn: () => api.post('/movimentacoes', {
      produto_id: produtoId,
      tipo,
      quantidade: parseFloat(quantidade),
      turno: turno || undefined,
      referencia: referencia || undefined,
      observacao: observacao || undefined,
    }),
    onSuccess: (res) => {
      invalidateOperationalData(queryClient, produtoId);
      if (res.data.aviso) {
        setAviso(res.data.aviso);
        setTimeout(onClose, 2500);
      } else {
        onClose();
      }
    },
    onError: (e) => setErro(e.message || 'Erro ao criar movimentação'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setErro('');
    setAviso('');
    if (!produtoId) return setErro('Selecione um produto');
    if (!quantidade || parseFloat(quantidade) <= 0) return setErro('Quantidade deve ser > 0');
    if (!turno) return setErro('Selecione o turno da movimentação');
    criar.mutate();
  };

  return (
    <div className="fixed inset-0 bg-navy-900/50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="p-5 border-b border-surface-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy-800">Nova movimentação</h2>
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
              autoFocus
            />
            {busca.length >= 2 && produtosRes?.data?.length > 0 && !produtoId && (
              <div className="mt-1 max-h-40 overflow-y-auto border border-surface-200 rounded-md bg-white shadow-sm">
                {produtosRes.data.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setProdutoId(p.id); setBusca(`${p.codigo} — ${p.nome}`); }}
                    className="w-full text-left px-3 py-2 hover:bg-surface-50 text-sm border-b border-surface-100 last:border-0"
                  >
                    <span className="font-medium text-navy-800">{p.codigo}</span>
                    <span className="text-navy-500 ml-2">{p.nome}</span>
                    <span className="text-xs text-navy-400 ml-2">(estoque: {p.estoque_atual})</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1">Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)} className="input w-full">
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {requerAprovacao && (
              <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Esse tipo requer aprovação de supervisor de turno
              </p>
            )}
          </div>

          {/* Quantidade */}
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1">Quantidade</label>
            <input
              type="number"
              step="0.0001"
              min="0"
              value={quantidade}
              onChange={e => setQuantidade(e.target.value)}
              className="input w-full font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1">Turno</label>
            <select value={turno} onChange={e => setTurno(e.target.value)} className="input w-full" required disabled={carregandoTurnos}>
              <option value="">Selecionar turno</option>
              {turnos.map(t => <option key={t.id} value={t.id}>{t.nome} ({t.inicio}-{t.fim})</option>)}
            </select>
          </div>

          {/* Referência */}
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1">Referência (opcional)</label>
            <input
              type="text"
              value={referencia}
              onChange={e => setReferencia(e.target.value)}
              placeholder="OP-1234, NF-5678..."
              className="input w-full"
            />
          </div>

          {/* Observação */}
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1">Observação (opcional)</label>
            <textarea
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              rows={2}
              className="input w-full resize-none"
            />
          </div>

          {erro && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3">{erro}</div>}
          {aviso && <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-md p-3">{aviso}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={criar.isPending} className="btn-primary">
              {criar.isPending ? 'Salvando…' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Modal: Rejeitar ────────────────────────────────────────────────────────
const RejeitarModal = ({ movimentacao, onClose, onConfirm, loading }) => {
  const [motivo, setMotivo] = useState('');
  const handleSubmit = (e) => {
    e.preventDefault();
    if (motivo.trim().length < 5) return;
    onConfirm(motivo.trim());
  };
  return (
    <div className="fixed inset-0 bg-navy-900/50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-5 border-b border-surface-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-red-700">Rejeitar movimentação</h2>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="text-sm text-navy-600">
            <p>Produto: <strong>{movimentacao.produto_codigo}</strong> — {movimentacao.produto_nome}</p>
            <p>Tipo: {movimentacao.tipo} · Quantidade: {formatNumber(movimentacao.quantidade)} {movimentacao.unidade}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1">Motivo da rejeição</label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={3}
              required
              minLength={5}
              maxLength={1000}
              placeholder="Explique o motivo (mínimo 5 caracteres)..."
              className="input w-full resize-none"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading || motivo.trim().length < 5} className="btn-danger">
              {loading ? 'Rejeitando…' : 'Confirmar rejeição'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Movimentacoes;
