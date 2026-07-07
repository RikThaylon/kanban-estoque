import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { Wrench, Plus, CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';

const STATUS_CONFIG = {
  OPEN:        { label: 'Aberta',      color: 'bg-blue-100 text-blue-800' },
  IN_PROGRESS: { label: 'Em Andamento', color: 'bg-amber-100 text-amber-800' },
  COMPLETED:   { label: 'Concluída',   color: 'bg-emerald-100 text-emerald-800' },
  CANCELED:    { label: 'Cancelada',   color: 'bg-red-100 text-red-800' },
};

export default function ServiceOrders() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedOS, setExpandedOS] = useState(null);
  const [consumeOS, setConsumeOS] = useState(null);
  const [consumeForm, setConsumeForm] = useState({ product_id: '', quantity: '', notes: '' });
  const [statusFilter, setStatusFilter] = useState('');

  const [formOS, setFormOS] = useState({ machine_id: '', department_id: '', notes: '' });

  // Lista OS
  const { data: osData, isLoading } = useQuery({
    queryKey: ['service_orders', statusFilter],
    queryFn: async () => {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      return (await api.get(`/service-orders${params}`)).data;
    }
  });

  // Máquinas e Departamentos para o form
  const { data: maquinas } = useQuery({
    queryKey: ['maquinas'],
    queryFn: async () => {
      try { return (await api.get('/maquinas')).data; } catch { return []; }
    }
  });

  const { data: departamentos } = useQuery({
    queryKey: ['departamentos'],
    queryFn: async () => {
      try { return (await api.get('/departamentos')).data; } catch { return []; }
    }
  });

  // Produtos MRO para consumo
  const { data: produtosMro } = useQuery({
    queryKey: ['produtos_mro'],
    queryFn: async () => {
      try {
        const res = await api.get('/produtos?limit=200');
        return (res.data.data || []).filter(p => p.category === 'machine_mro');
      } catch { return []; }
    }
  });

  const createOS = useMutation({
    mutationFn: (data) => api.post('/service-orders', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['service_orders']);
      setShowForm(false);
      setFormOS({ machine_id: '', department_id: '', notes: '' });
    }
  });

  const closeOS = useMutation({
    mutationFn: (id) => api.patch(`/service-orders/${id}/close`),
    onSuccess: () => queryClient.invalidateQueries(['service_orders'])
  });

  const consumeMaterial = useMutation({
    mutationFn: ({ id, data }) => api.post(`/service-orders/${id}/consume`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['service_orders']);
      setConsumeOS(null);
      setConsumeForm({ product_id: '', quantity: '', notes: '' });
    },
    onError: (err) => {
      alert(err.response?.data?.message || 'Erro ao registrar consumo.');
    }
  });

  const orders = osData?.data || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-steel-800 flex items-center gap-2">
            <Wrench className="w-6 h-6 text-brand-500" /> Ordens de Serviço (MRO)
          </h1>
          <p className="text-sm text-steel-400 mt-1">Gestão de manutenções com baixa de estoque transacional (SELECT FOR UPDATE)</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" /> Nova OS
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {['', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              statusFilter === s
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-steel-600 border-surface-200 hover:border-brand-400'
            }`}
          >
            {s === '' ? 'Todas' : STATUS_CONFIG[s]?.label}
          </button>
        ))}
      </div>

      {/* Form Nova OS */}
      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-surface-200">
          <h2 className="text-lg font-bold text-steel-800 mb-4">Gerar Nova Ordem de Serviço</h2>
          <form onSubmit={(e) => { e.preventDefault(); createOS.mutate(formOS); }} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-steel-700 mb-1">Máquina *</label>
              <select required className="input-base w-full" value={formOS.machine_id} onChange={e => setFormOS({ ...formOS, machine_id: e.target.value })}>
                <option value="">Selecione...</option>
                {(Array.isArray(maquinas) ? maquinas : maquinas?.data || []).map(m => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-steel-700 mb-1">Departamento *</label>
              <select required className="input-base w-full" value={formOS.department_id} onChange={e => setFormOS({ ...formOS, department_id: e.target.value })}>
                <option value="">Selecione...</option>
                {(Array.isArray(departamentos) ? departamentos : departamentos?.data || []).map(d => (
                  <option key={d.id} value={d.id}>{d.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-steel-700 mb-1">Observações</label>
              <input className="input-base w-full" value={formOS.notes} onChange={e => setFormOS({ ...formOS, notes: e.target.value })} placeholder="Defeito relatado..." />
            </div>
            <div className="sm:col-span-3 flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" disabled={createOS.isLoading} className="btn-primary">Criar OS</button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de OS */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center p-8 text-steel-400">Carregando ordens...</div>
        ) : orders.length === 0 ? (
          <div className="text-center p-12 bg-white rounded-xl border border-surface-200">
            <Wrench className="w-10 h-10 text-steel-300 mx-auto mb-3" />
            <p className="text-steel-500 font-medium">Nenhuma Ordem de Serviço encontrada.</p>
          </div>
        ) : (
          orders.map(os => {
            const statusConf = STATUS_CONFIG[os.status] || STATUS_CONFIG.OPEN;
            const isOpen = os.status === 'OPEN' || os.status === 'IN_PROGRESS';
            return (
              <div key={os.id} className="bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
                {/* OS Header */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-surface-50 transition-colors"
                  onClick={() => setExpandedOS(expandedOS === os.id ? null : os.id)}
                >
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <p className="text-xs text-steel-400">Número</p>
                      <p className="font-bold text-steel-800 font-mono">{os.number}</p>
                    </div>
                    <div>
                      <p className="text-xs text-steel-400">Máquina</p>
                      <p className="font-medium text-steel-700">{os.machine_name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-steel-400">Departamento</p>
                      <p className="font-medium text-steel-700">{os.department_name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-steel-400">Materiais</p>
                      <p className="font-medium text-steel-700">{os.materials_count || 0} itens</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${statusConf.color}`}>
                    {statusConf.label}
                  </span>
                  {expandedOS === os.id ? <ChevronDown className="w-4 h-4 text-steel-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-steel-400 shrink-0" />}
                </div>

                {/* OS Body - Expandida */}
                {expandedOS === os.id && (
                  <div className="border-t border-surface-100 p-4 bg-surface-50 space-y-4">
                    {os.notes && (
                      <p className="text-sm text-steel-600 italic">"{os.notes}"</p>
                    )}

                    {/* Registrar Consumo */}
                    {isOpen && (
                      <div className="bg-white p-4 rounded-lg border border-surface-200">
                        <h4 className="font-bold text-sm text-steel-700 mb-3">
                          Registrar Consumo de Peça (MRO) — Transação ACID com Row Lock
                        </h4>
                        {consumeOS === os.id ? (
                          <form onSubmit={(e) => {
                            e.preventDefault();
                            consumeMaterial.mutate({ id: os.id, data: consumeForm });
                          }} className="flex flex-col md:flex-row gap-2 items-end">
                            <div className="flex-1">
                              <select required className="input-base w-full" value={consumeForm.product_id} onChange={e => setConsumeForm({ ...consumeForm, product_id: e.target.value })}>
                                <option value="">Selecione a peça MRO...</option>
                                {produtosMro?.map(p => (
                                  <option key={p.id} value={p.id}>{p.codigo} — {p.nome} (Estoque: {p.estoque_atual} {p.unidade})</option>
                                ))}
                              </select>
                            </div>
                            <div className="w-28">
                              <input required type="number" min="0.0001" step="0.0001" placeholder="Qtd" className="input-base w-full" value={consumeForm.quantity} onChange={e => setConsumeForm({ ...consumeForm, quantity: e.target.value })} />
                            </div>
                            <input placeholder="Obs. (opcional)" className="input-base flex-1" value={consumeForm.notes} onChange={e => setConsumeForm({ ...consumeForm, notes: e.target.value })} />
                            <button type="submit" disabled={consumeMaterial.isLoading} className="btn-primary whitespace-nowrap">
                              {consumeMaterial.isLoading ? 'Baixando...' : 'Confirmar Baixa'}
                            </button>
                            <button type="button" onClick={() => setConsumeOS(null)} className="btn-secondary">Cancelar</button>
                          </form>
                        ) : (
                          <button onClick={() => setConsumeOS(os.id)} className="btn-secondary">
                            + Adicionar Material Consumido
                          </button>
                        )}
                        <p className="text-xs text-steel-400 mt-2">
                          ⚙️ O sistema executa <code className="bg-surface-100 px-1 rounded">SELECT FOR UPDATE</code> no estoque antes de deduzir — à prova de race conditions.
                        </p>
                      </div>
                    )}

                    {/* Botão Fechar OS */}
                    {isOpen && (
                      <div className="flex justify-end">
                        <button
                          onClick={() => { if (confirm(`Concluir a OS ${os.number}?`)) closeOS.mutate(os.id); }}
                          disabled={closeOS.isLoading}
                          className="btn-secondary text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Marcar como Concluída
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
