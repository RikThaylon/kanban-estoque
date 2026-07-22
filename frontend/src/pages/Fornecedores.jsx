import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit2, Trash2, X, Building2, MapPin, Mail, Phone,
  RotateCcw, Package, History, ChevronRight, Star, Truck,
  Search, Filter, CheckCircle2, AlertTriangle
} from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { invalidateOperationalData } from '../utils/queryInvalidation';
import { useAutoSave } from '../hooks/useAutoSave';

const MODAL_VALIDOS = ['rodoviario', 'aereo', 'maritimo', 'ferroviario', 'expresso', 'motoboy', 'correios'];

const ModalIcons = { rodoviario: '🚛', aereo: '✈️', maritimo: '🚢', ferroviario: '🚂', expresso: '⚡', motoboy: '🏍️', correios: '📮' };

const Fornecedores = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.perfil === 'admin';
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState(null);
  const [detalhesModal, setDetalhesModal] = useState(null);
  const [busca, setBusca] = useState('');
  const [showInativos, setShowInativos] = useState(false);

  const { data: fornecedores, isLoading } = useQuery({
    queryKey: ['fornecedores', showInativos ? 'all' : 'ativos'],
    queryFn: async () => (await api.get('/fornecedores', {
      params: { ativo: showInativos ? 'all' : 'true' }
    })).data,
  });

  const filtrados = (fornecedores || []).filter(f =>
    !busca || f.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (f.cnpj && f.cnpj.includes(busca))
  );

  const ativos = filtrados.filter(f => f.ativo !== false);
  const inativos = filtrados.filter(f => f.ativo === false);

  const desativar = useMutation({
    mutationFn: (id) => api.delete(`/fornecedores/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      invalidateOperationalData(queryClient);
    },
  });

  const reativar = useMutation({
    mutationFn: (id) => api.patch(`/fornecedores/${id}/reativar`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      invalidateOperationalData(queryClient);
    },
  });

  const handleEdit = (forn) => { setEditingFornecedor(forn); setModalOpen(true); };
  const handleNew = () => { setEditingFornecedor(null); setModalOpen(true); };
  const handleDelete = (id, nome) => {
    if (window.confirm(`Desativar fornecedor "${nome}"?\nPedidos em andamento impedirão a desativação.`)) {
      desativar.mutate(id);
    }
  };
  const handleReativar = (id, nome) => {
    if (window.confirm(`Reativar fornecedor "${nome}"?`)) reativar.mutate(id);
  };

  const FornecedorCard = ({ forn }) => (
    <div className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all relative group card-hover stagger-item ${
      !forn.ativo ? 'border-surface-200 opacity-60' : 'border-surface-200'
    }`}>
      {/* Badge inativo */}
      {!forn.ativo && (
        <div className="absolute top-3 right-3 bg-slate-100 text-slate-500 text-xs font-bold px-2 py-0.5 rounded-full border border-slate-200">
          INATIVO
        </div>
      )}

      {/* Botões admin */}
      {isAdmin && forn.ativo && (
        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
          <button
            onClick={() => setDetalhesModal(forn)}
            className="p-1.5 text-steel-400 hover:text-accent hover:bg-red-50 rounded-lg transition-colors"
            title="Ver produtos e histórico"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button onClick={() => handleEdit(forn)} className="p-1.5 text-steel-400 hover:text-accent hover:bg-red-50 rounded-lg transition-colors" title="Editar">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={() => handleDelete(forn.id, forn.nome)} className="p-1.5 text-steel-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Desativar">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Botão reativar */}
      {isAdmin && !forn.ativo && (
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-200">
          <button
            onClick={() => handleReativar(forn.id, forn.nome)}
            className="p-1.5 text-steel-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
            title="Reativar"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            forn.ativo ? 'bg-red-50' : 'bg-slate-100'
          }`}>
            <Building2 className={`w-5 h-5 ${forn.ativo ? 'text-primary' : 'text-slate-400'}`} />
          </div>
          <div className="min-w-0 pr-12">
            <h3 className="font-bold text-steel-800 leading-tight truncate">{forn.nome}</h3>
            <p className="text-xs text-steel-400 font-mono mt-0.5">{forn.cnpj || 'Sem CNPJ'}</p>
          </div>
        </div>

        <div className="space-y-2 text-sm text-steel-600">
          {(forn.cidade || forn.estado) && (
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-steel-400 shrink-0" />
              <span className="truncate">{forn.cidade}{forn.cidade && forn.estado ? ' — ' : ''}{forn.estado}</span>
            </div>
          )}
          {forn.contato_email && (
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-steel-400 shrink-0" />
              <span className="truncate text-xs">{forn.contato_email}</span>
            </div>
          )}
          {forn.contato_telefone && (
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-steel-400 shrink-0" />
              <span className="text-xs">{forn.contato_telefone}</span>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-surface-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-steel-500">
            <Package className="w-3.5 h-3.5" />
            {forn.total_produtos || 0} produto{forn.total_produtos !== 1 ? 's' : ''}
          </div>
          {forn.modal_padrao && (
            <span className="text-xs font-bold bg-surface-100 text-steel-600 px-2 py-0.5 rounded-lg">
              {ModalIcons[forn.modal_padrao] || '🚚'} {forn.modal_padrao}
            </span>
          )}
        </div>

        {forn.avaliacao && (
          <div className="mt-2 flex items-center gap-1">
            {[1,2,3,4,5].map(n => (
              <Star key={n} className={`w-3 h-3 ${n <= Math.round(forn.avaliacao) ? 'text-amber-400 fill-amber-400' : 'text-surface-200'}`} />
            ))}
            <span className="text-xs text-steel-400 ml-1">{parseFloat(forn.avaliacao).toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-steel-800">Fornecedores</h1>
          <p className="text-steel-400 text-sm">Gestão de parceiros comerciais e prestadores</p>
        </div>
        {isAdmin && (
          <button onClick={handleNew} className="btn-primary w-full sm:w-auto justify-center">
            <Plus className="w-4 h-4" /> Novo Fornecedor
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-steel-400" />
          <input
            className="input w-full pl-10"
            placeholder="Buscar por nome ou CNPJ..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowInativos(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
              showInativos
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-steel-600 border-surface-200 hover:border-steel-300'
            }`}
          >
            <Filter className="w-4 h-4" />
            {showInativos ? 'Mostrando todos' : 'Ver inativos'}
          </button>
        )}
      </div>

      {/* Cards ativos */}
      {isLoading ? (
        <div className="text-center py-12 text-steel-400">Carregando fornecedores...</div>
      ) : ativos.length === 0 && inativos.length === 0 ? (
        <div className="text-center py-12 text-steel-400 bg-white rounded-xl border border-surface-200">
          Nenhum fornecedor encontrado.
        </div>
      ) : (
        <>
          {ativos.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ativos.map(forn => <FornecedorCard key={forn.id} forn={forn} />)}
            </div>
          )}

          {/* Inativos */}
          {inativos.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-steel-500 uppercase tracking-wider mb-3">
                Fornecedores Inativos ({inativos.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inativos.map(forn => <FornecedorCard key={forn.id} forn={forn} />)}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal novo/editar */}
      {modalOpen && (
        <FornecedorModal
          fornecedor={editingFornecedor}
          onClose={() => setModalOpen(false)}
        />
      )}

      {/* Modal detalhes */}
      {detalhesModal && (
        <FornecedorDetalhesModal
          fornecedor={detalhesModal}
          onClose={() => setDetalhesModal(null)}
        />
      )}
    </div>
  );
};

// Importar Eye icon que esquecemos acima
import { Eye } from 'lucide-react';

const FornecedorModal = ({ fornecedor, onClose }) => {
  const queryClient = useQueryClient();
  const isEditing = !!fornecedor;
  const [erro, setErro] = useState('');

  const [form, setForm] = useState({
    nome: fornecedor?.nome || '',
    cnpj: fornecedor?.cnpj || '',
    contato_nome: fornecedor?.contato_nome || '',
    contato_email: fornecedor?.contato_email || '',
    contato_telefone: fornecedor?.contato_telefone || '',
    cidade: fornecedor?.cidade || '',
    estado: fornecedor?.estado || '',
    modal_padrao: fornecedor?.modal_padrao || '',
    prazo_pagamento_dias: fornecedor?.prazo_pagamento_dias || '',
    avaliacao: fornecedor?.avaliacao || '',
    observacoes: fornecedor?.observacoes || '',
  });

  const f = (k, v) => setForm(s => ({ ...s, [k]: v }));

  // Auto Save — salva rascunho apenas para novos fornecedores
  const draftKey = isEditing ? null : 'form_novo_fornecedor';
  const { saveStatus, hasDraft, draftAge, clearDraft, restoreDraft, discardDraft } = useAutoSave(
    draftKey || '__noop__',
    form,
    {
      enabled: !isEditing, // Apenas para criação (não edição)
      onRestore: (data) => setForm(s => ({ ...s, ...data })),
    }
  );

  const salvar = useMutation({
    mutationFn: async (dados) => {
      if (isEditing) return (await api.patch(`/fornecedores/${fornecedor.id}`, dados)).data;
      return (await api.post('/fornecedores', dados)).data;
    },
    onSuccess: () => {
      clearDraft(); // Limpa rascunho após salvar com sucesso
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      invalidateOperationalData(queryClient);
      onClose();
    },
    onError: (e) => setErro(e.response?.data?.message || e.message || 'Erro ao salvar fornecedor'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setErro('');
    if (form.nome.trim().length < 2) return setErro('Nome é obrigatório (mínimo 2 caracteres)');
    const payload = { ...form };
    if (!payload.cnpj) delete payload.cnpj;
    if (payload.prazo_pagamento_dias === '') delete payload.prazo_pagamento_dias;
    else payload.prazo_pagamento_dias = parseInt(payload.prazo_pagamento_dias);
    if (payload.avaliacao === '') delete payload.avaliacao;
    else if (payload.avaliacao) payload.avaliacao = parseFloat(payload.avaliacao);
    salvar.mutate(payload);
  };

  return (
    <div className="fixed inset-0 bg-navy-900/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 modal-overlay-enter">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col modal-spring-enter sm:modal-spring-enter">
        <div className="p-5 border-b border-surface-200 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-steel-800">{isEditing ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h2>
            <p className="text-xs text-steel-400 mt-0.5">Todos os campos podem ser editados pelo administrador</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Indicador de Auto Save */}
            {!isEditing && saveStatus === 'saved' && (
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1 badge-pop">
                <CheckCircle2 className="w-3 h-3" /> Rascunho salvo
              </span>
            )}
            <button onClick={onClose} className="p-2 text-steel-400 hover:text-steel-600 hover:bg-surface-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Banner de Rascunho */}
        {hasDraft && !isEditing && (
          <div className="mx-5 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Rascunho salvo <strong>{draftAge}</strong>. Deseja restaurar?</span>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={discardDraft} className="text-xs text-amber-600 hover:underline">Descartar</button>
              <button onClick={restoreDraft} className="text-xs font-bold text-accent hover:underline">Restaurar</button>
            </div>
          </div>
        )}

        <div className="p-5 overflow-y-auto flex-1">
          {erro && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />{erro}
            </div>
          )}
          <form id="forn-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Informações Principais */}
            <div className="bg-surface-50 border border-surface-200 rounded-xl p-4 sm:p-5">
              <h3 className="text-sm font-bold text-steel-800 flex items-center gap-2 mb-4">
                <Building2 className="w-4 h-4 text-accent" /> Informações Principais
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label">Nome / Razão Social *</label>
                  <input className="input w-full" value={form.nome} onChange={e => f('nome', e.target.value)} required />
                </div>
                <div>
                  <label className="label">CNPJ</label>
                  <input className="input w-full font-mono" value={form.cnpj} onChange={e => f('cnpj', e.target.value)} placeholder="00.000.000/0000-00" />
                </div>
                <div>
                  <label className="label">Modal de Transporte Padrão</label>
                  <div className="relative">
                    <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-steel-400" />
                    <select className="input w-full pl-9" value={form.modal_padrao} onChange={e => f('modal_padrao', e.target.value)}>
                      <option value="">Selecione...</option>
                      {MODAL_VALIDOS.map(m => (
                        <option key={m} value={m}>{ModalIcons[m]} {m.charAt(0).toUpperCase() + m.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Contato & Localização */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-surface-50 border border-surface-200 rounded-xl p-4 sm:p-5">
                <h3 className="text-sm font-bold text-steel-800 flex items-center gap-2 mb-4">
                  <Mail className="w-4 h-4 text-accent" /> Contato
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="label">Pessoa de Contato</label>
                    <input className="input w-full" value={form.contato_nome} onChange={e => f('contato_nome', e.target.value)} placeholder="Nome do representante" />
                  </div>
                  <div>
                    <label className="label">Telefone</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-steel-400" />
                      <input className="input w-full pl-9 font-mono" value={form.contato_telefone} onChange={e => f('contato_telefone', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="label">E-mail</label>
                    <input type="email" className="input w-full" value={form.contato_email} onChange={e => f('contato_email', e.target.value)} placeholder="email@empresa.com" />
                  </div>
                </div>
              </div>

              <div className="bg-surface-50 border border-surface-200 rounded-xl p-4 sm:p-5">
                <h3 className="text-sm font-bold text-steel-800 flex items-center gap-2 mb-4">
                  <MapPin className="w-4 h-4 text-accent" /> Localização
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="label">Cidade</label>
                    <input className="input w-full" value={form.cidade} onChange={e => f('cidade', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Estado (UF)</label>
                    <input className="input w-full uppercase" maxLength={2} value={form.estado} onChange={e => f('estado', e.target.value.toUpperCase())} placeholder="SP, MG, RJ..." />
                  </div>
                </div>
              </div>
            </div>

            {/* Comercial & Observações */}
            <div className="bg-surface-50 border border-surface-200 rounded-xl p-4 sm:p-5">
              <h3 className="text-sm font-bold text-steel-800 flex items-center gap-2 mb-4">
                <Star className="w-4 h-4 text-accent" /> Dados Comerciais
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Prazo de Pagamento (Dias)</label>
                  <input type="number" min="0" className="input w-full font-mono" value={form.prazo_pagamento_dias} onChange={e => f('prazo_pagamento_dias', e.target.value)} placeholder="Ex: 30" />
                </div>
                <div>
                  <label className="label">Avaliação do Fornecedor (0-5)</label>
                  <div className="relative">
                    <Star className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                    <input type="number" min="0" max="5" step="0.1" className="input w-full pl-9 font-mono" value={form.avaliacao} onChange={e => f('avaliacao', e.target.value)} placeholder="Ex: 4.8" />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Observações Internas</label>
                  <textarea className="input w-full resize-y" rows={3} value={form.observacoes} onChange={e => f('observacoes', e.target.value)} placeholder="Notas sobre qualidade, flexibilidade, restrições..." />
                </div>
              </div>
            </div>

          </form>
        </div>

        <div className="p-5 border-t border-surface-200 flex justify-end gap-3 bg-surface-50 rounded-b-2xl">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="submit" form="forn-form" disabled={salvar.isPending} className="btn-primary">
            {salvar.isPending ? 'Salvando...' : (isEditing ? 'Salvar Alterações' : 'Criar Fornecedor')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Modal Detalhes (Produtos + Histórico) ────────────────────────────────────
const FornecedorDetalhesModal = ({ fornecedor, onClose }) => {
  const [tab, setTab] = useState('produtos');

  const { data: produtos, isLoading: loadingProdutos } = useQuery({
    queryKey: ['fornecedor-produtos', fornecedor.id],
    queryFn: async () => (await api.get(`/fornecedores/${fornecedor.id}/produtos`)).data,
    enabled: tab === 'produtos',
  });

  const { data: historico, isLoading: loadingHistorico } = useQuery({
    queryKey: ['fornecedor-historico', fornecedor.id],
    queryFn: async () => (await api.get(`/fornecedores/${fornecedor.id}/historico`)).data,
    enabled: tab === 'historico',
  });

  return (
    <div className="fixed inset-0 bg-navy-900/60 flex items-center justify-center z-50 p-4 modal-overlay-enter">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col modal-spring-enter">
        <div className="p-5 border-b border-surface-200 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-steel-800">{fornecedor.nome}</h2>
              <p className="text-xs text-steel-400">{fornecedor.cnpj || 'Sem CNPJ'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-steel-400 hover:text-steel-600 hover:bg-surface-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-4 pb-0">
          {[
            { id: 'produtos', label: 'Produtos Vinculados', icon: Package },
            { id: 'historico', label: 'Histórico de Pedidos', icon: History },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border-b-2 transition-all ${
                tab === t.id ? 'border-accent text-accent bg-red-50' : 'border-transparent text-steel-500 hover:text-steel-700'
              }`}
            >
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {/* Produtos */}
          {tab === 'produtos' && (
            loadingProdutos ? <div className="text-center py-8 text-steel-400">Carregando...</div> :
            !produtos?.length ? <div className="text-center py-8 text-steel-400">Nenhum produto vinculado</div> : (
              <div className="space-y-2">
                {produtos.map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-surface-200 hover:bg-surface-50 transition-colors stagger-item">
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: `#${p.cor_hex || 'CBD5E1'}`, flexShrink: 0 }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-steel-800 text-sm truncate">{p.nome}</div>
                      <div className="text-xs text-steel-400">{p.codigo} · {p.categoria_nome || 'Sem categoria'}</div>
                    </div>
                    <div className="text-xs font-mono text-steel-500">{p.estoque_atual} {p.unidade}</div>
                    <div className="text-xs text-steel-400">Prioridade {p.prioridade}</div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Histórico */}
          {tab === 'historico' && (
            loadingHistorico ? <div className="text-center py-8 text-steel-400">Carregando...</div> :
            !historico?.length ? <div className="text-center py-8 text-steel-400">Nenhum pedido registrado</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-200">
                      {['Pedido', 'Produto', 'Qtd', 'Status', 'Lead Time', 'Data'].map(h => (
                        <th key={h} className="text-left py-2 px-2 text-steel-500 font-semibold text-xs uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historico.map(p => (
                      <tr key={p.id} className="border-b border-surface-100 hover:bg-surface-50 stagger-item">
                        <td className="py-2 px-2 font-mono text-xs text-steel-600">{p.numero}</td>
                        <td className="py-2 px-2 text-steel-700 text-xs">{p.produto_nome}</td>
                        <td className="py-2 px-2 font-mono text-xs">{p.quantidade_pedida}</td>
                        <td className="py-2 px-2">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-100 text-steel-600">{p.status}</span>
                        </td>
                        <td className="py-2 px-2 font-mono text-xs text-steel-500">
                          {p.lead_time_real_dias ? `${p.lead_time_real_dias}d` : '—'}
                        </td>
                        <td className="py-2 px-2 text-xs text-steel-400">
                          {p.criado_em ? new Date(p.criado_em).toLocaleDateString('pt-BR') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default Fornecedores;
