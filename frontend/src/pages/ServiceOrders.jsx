import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { Settings, Tool, Plus, Play, CheckCircle } from 'lucide-react';

export default function ServiceOrders() {
  const queryClient = useQueryClient();
  const [formOS, setFormOS] = useState({ machine_id: '', department_id: '', notes: '' });
  const [consumeForm, setConsumeForm] = useState({ product_id: '', quantity: '' });

  const { data: maquinas } = useQuery({
    queryKey: ['maquinas'],
    queryFn: async () => (await api.get('/maquinas')).data
  });

  const { data: departamentos } = useQuery({
    queryKey: ['departamentos'],
    queryFn: async () => (await api.get('/departamentos')).data
  });

  // Idealmente teriamos um endpoint GET /api/v1/service-orders
  // Simularemos mock na interface para simplificar a prova arquitetural
  const [serviceOrders, setServiceOrders] = useState([]);

  const createOS = useMutation({
    mutationFn: (data) => api.post('/service-orders', data),
    onSuccess: (res) => {
      setServiceOrders([res.data, ...serviceOrders]);
      setFormOS({ machine_id: '', department_id: '', notes: '' });
    }
  });

  const consumeMaterial = useMutation({
    mutationFn: ({ id, data }) => api.post(\`/service-orders/\${id}/consume\`, data),
    onSuccess: () => {
       alert("Material consumido com sucesso. Baixa de estoque registrada.");
    },
    onError: (err) => {
       alert(err.response?.data?.message || "Erro ao registrar consumo");
    }
  });

  const { data: produtos } = useQuery({
    queryKey: ['produtos_mro'],
    queryFn: async () => (await api.get('/produtos?limit=100')).data.data
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-steel-800 mb-6">Ordens de Serviço (Manutenção MRO)</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-surface-200 h-fit">
          <h2 className="text-lg font-bold text-steel-800 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-brand-500" />
            Nova Ordem de Serviço
          </h2>
          <form onSubmit={(e) => {
            e.preventDefault();
            createOS.mutate(formOS);
          }} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-steel-700 mb-1">Máquina</label>
              <select required className="input-base w-full" value={formOS.machine_id} onChange={e => setFormOS({...formOS, machine_id: e.target.value})}>
                <option value="">Selecione...</option>
                {maquinas?.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-steel-700 mb-1">Departamento</label>
              <select required className="input-base w-full" value={formOS.department_id} onChange={e => setFormOS({...formOS, department_id: e.target.value})}>
                <option value="">Selecione...</option>
                {departamentos?.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-steel-700 mb-1">Observações</label>
              <textarea className="input-base w-full" rows="3" value={formOS.notes} onChange={e => setFormOS({...formOS, notes: e.target.value})}></textarea>
            </div>
            <button type="submit" disabled={createOS.isLoading} className="btn-primary w-full justify-center">Gerar OS</button>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-steel-800 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand-500" />
            Ordens Abertas (Transação ACID)
          </h2>
          {serviceOrders.length === 0 ? (
             <div className="text-center p-8 bg-surface-50 rounded-lg border border-surface-200">
                <p className="text-steel-500">Nenhuma Ordem de Serviço gerada nesta sessão.</p>
             </div>
          ) : (
            serviceOrders.map(os => (
              <div key={os.id} className="bg-white p-4 rounded-xl shadow-sm border border-surface-200">
                <div className="flex justify-between items-center mb-4">
                   <h3 className="font-bold text-lg text-steel-800">{os.number}</h3>
                   <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-bold">{os.status}</span>
                </div>
                
                <div className="bg-surface-50 p-4 rounded-lg">
                  <h4 className="font-bold text-sm text-steel-700 mb-2">Registrar Consumo de Material</h4>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    consumeMaterial.mutate({ id: os.id, data: consumeForm });
                  }} className="flex flex-col md:flex-row gap-2">
                    <select required className="input-base flex-1" value={consumeForm.product_id} onChange={e => setConsumeForm({...consumeForm, product_id: e.target.value})}>
                      <option value="">Peça / Material (MRO)...</option>
                      {produtos?.filter(p => p.category === 'machine_mro').map(p => (
                         <option key={p.id} value={p.id}>{p.codigo} - {p.nome} (Estoque: {p.estoque_atual})</option>
                      ))}
                    </select>
                    <input required type="number" min="0.0001" step="0.0001" placeholder="Qtd" className="input-base w-24" value={consumeForm.quantity} onChange={e => setConsumeForm({...consumeForm, quantity: e.target.value})} />
                    <button type="submit" disabled={consumeMaterial.isLoading} className="btn-secondary whitespace-nowrap">Baixar Estoque</button>
                  </form>
                  <p className="text-xs text-steel-400 mt-2">* Ao baixar estoque, o sistema efetuará Row-level locking (SELECT FOR UPDATE) no PostgreSQL.</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
