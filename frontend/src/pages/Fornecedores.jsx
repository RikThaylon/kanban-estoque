import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, X, Building2, MapPin, Mail, Phone } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';

const Fornecedores = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.perfil === 'admin';
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState(null);

  const { data: fornecedores, isLoading } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: async () => (await api.get('/fornecedores', { params: { ativo: true } })).data,
  });

  const desativar = useMutation({
    mutationFn: (id) => api.delete(`/fornecedores/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fornecedores'] }),
  });

  const handleEdit = (forn) => {
    setEditingFornecedor(forn);
    setModalOpen(true);
  };

  const handleNew = () => {
    setEditingFornecedor(null);
    setModalOpen(true);
  };

  const handleDelete = (id, nome) => {
    if (window.confirm(`Tem certeza que deseja desativar o fornecedor ${nome}?`)) {
      desativar.mutate(id);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-navy-800">Fornecedores</h1>
          <p className="text-navy-400 text-sm">Gestão de parceiros comerciais e prestadores</p>
        </div>
        {isAdmin && (
          <button onClick={handleNew} className="btn-primary w-full sm:w-auto justify-center">
            <Plus className="w-4 h-4 mr-2" /> Novo Fornecedor
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center p-8 text-navy-400">Carregando fornecedores...</div>
        ) : fornecedores?.length === 0 ? (
          <div className="col-span-full text-center p-8 text-navy-400 bg-white rounded-xl border border-surface-200">
            Nenhum fornecedor cadastrado.
          </div>
        ) : (
          fornecedores?.map(forn => (
            <div key={forn.id} className="bg-white rounded-xl border border-surface-200 p-5 shadow-sm hover:shadow-md transition-shadow relative group">
              {isAdmin && (
                <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(forn)} className="p-1.5 text-navy-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Editar">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(forn.id, forn.nome)} className="p-1.5 text-navy-400 hover:text-red-600 hover:bg-red-50 rounded" title="Desativar">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-navy-800 leading-tight pr-12">{forn.nome}</h3>
                  <p className="text-xs text-navy-500 font-mono mt-0.5">{forn.cnpj || 'Sem CNPJ'}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm text-navy-600">
                {(forn.cidade || forn.estado) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-navy-400 shrink-0" />
                    <span className="truncate">{forn.cidade}{forn.cidade && forn.estado ? ' - ' : ''}{forn.estado}</span>
                  </div>
                )}
                {forn.contato_email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-navy-400 shrink-0" />
                    <span className="truncate">{forn.contato_email}</span>
                  </div>
                )}
                {forn.contato_telefone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-navy-400 shrink-0" />
                    <span>{forn.contato_telefone}</span>
                  </div>
                )}
              </div>

              {forn.modal_padrao && (
                <div className="mt-4 pt-4 border-t border-surface-100 flex justify-between items-center">
                  <span className="text-xs font-medium text-navy-400 uppercase tracking-wider">Modal Padrão</span>
                  <span className="text-xs font-bold bg-surface-100 text-navy-700 px-2 py-0.5 rounded">{forn.modal_padrao}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {modalOpen && (
        <FornecedorModal
          fornecedor={editingFornecedor}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
};

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
  });

  const f = (k, v) => setForm(s => ({ ...s, [k]: v }));

  const salvar = useMutation({
    mutationFn: async (dados) => {
      if (isEditing) {
        return (await api.patch(`/fornecedores/${fornecedor.id}`, dados)).data;
      }
      return (await api.post('/fornecedores', dados)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      onClose();
    },
    onError: (e) => setErro(e.message || 'Erro ao salvar fornecedor'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setErro('');
    if (form.nome.trim().length < 2) return setErro('Nome é obrigatório');
    
    // Limpar payload
    const payload = { ...form };
    if (!payload.cnpj) delete payload.cnpj;
    if (payload.prazo_pagamento_dias === '') delete payload.prazo_pagamento_dias;
    else payload.prazo_pagamento_dias = parseInt(payload.prazo_pagamento_dias);

    salvar.mutate(payload);
  };

  return (
    <div className="fixed inset-0 bg-navy-900/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-surface-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-navy-800">{isEditing ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h2>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {erro && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{erro}</div>}
          
          <form id="forn-form" onSubmit={handleSubmit} className="space-y-4">
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
                <select className="input w-full" value={form.modal_padrao} onChange={e => f('modal_padrao', e.target.value)}>
                  <option value="">Selecione...</option>
                  <option value="RODOVIARIO">Rodoviário</option>
                  <option value="AEREO">Aéreo</option>
                  <option value="MARITIMO">Marítimo</option>
                  <option value="MOTOBOY">Motoboy</option>
                  <option value="CORREIOS">Correios</option>
                </select>
              </div>

              <div>
                <label className="label">Contato (Nome)</label>
                <input className="input w-full" value={form.contato_nome} onChange={e => f('contato_nome', e.target.value)} />
              </div>

              <div>
                <label className="label">Telefone</label>
                <input className="input w-full font-mono" value={form.contato_telefone} onChange={e => f('contato_telefone', e.target.value)} />
              </div>

              <div className="sm:col-span-2">
                <label className="label">E-mail</label>
                <input type="email" className="input w-full" value={form.contato_email} onChange={e => f('contato_email', e.target.value)} />
              </div>

              <div>
                <label className="label">Cidade</label>
                <input className="input w-full" value={form.cidade} onChange={e => f('cidade', e.target.value)} />
              </div>

              <div>
                <label className="label">Estado (UF)</label>
                <input className="input w-full uppercase" maxLength={2} value={form.estado} onChange={e => f('estado', e.target.value)} />
              </div>
              
              <div>
                <label className="label">Prazo de Pagamento Padrão (Dias)</label>
                <input type="number" min="0" className="input w-full font-mono" value={form.prazo_pagamento_dias} onChange={e => f('prazo_pagamento_dias', e.target.value)} />
              </div>
            </div>
          </form>
        </div>

        <div className="p-5 border-t border-surface-200 flex justify-end gap-3 bg-surface-50 rounded-b-xl">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="submit" form="forn-form" disabled={salvar.isPending} className="btn-primary">
            {salvar.isPending ? 'Salvando...' : 'Salvar Fornecedor'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Fornecedores;
