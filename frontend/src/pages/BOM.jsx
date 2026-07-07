import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { AlertCircle, Plus, Trash2, Search, Link as LinkIcon } from 'lucide-react';
import { useAuth } from '../stores/authStore';

export default function BOM() {
  const [produtoId, setProdutoId] = useState('');
  const [busca, setBusca] = useState('');
  
  const { data: produtos } = useQuery({
    queryKey: ['produtos_bom'],
    queryFn: async () => (await api.get('/produtos?limit=100')).data.data
  });

  const { data: bomTree, isLoading } = useQuery({
    queryKey: ['bom', produtoId],
    queryFn: async () => (await api.get(\`/bom/\${produtoId}\`)).data,
    enabled: !!produtoId
  });

  const queryClient = useQueryClient();
  const addDependency = useMutation({
    mutationFn: (data) => api.post('/bom', data),
    onSuccess: () => queryClient.invalidateQueries(['bom', produtoId])
  });

  const removeDependency = useMutation({
    mutationFn: (id) => api.delete(\`/bom/\${id}\`),
    onSuccess: () => queryClient.invalidateQueries(['bom', produtoId])
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-steel-800 mb-6">Bill of Materials (BOM)</h1>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-surface-200 mb-6">
        <label className="block text-sm font-bold text-steel-700 mb-2">Produto Principal</label>
        <select 
          className="input-base w-full max-w-md"
          value={produtoId}
          onChange={(e) => setProdutoId(e.target.value)}
        >
          <option value="">Selecione um produto...</option>
          {produtos?.filter(p => p.category !== 'machine_mro').map(p => (
            <option key={p.id} value={p.id}>{p.codigo} - {p.nome}</option>
          ))}
        </select>
      </div>

      {produtoId && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-surface-200">
            <h2 className="text-lg font-bold text-steel-800 mb-4 flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-brand-500" />
              Árvore de Materiais
            </h2>
            
            {isLoading ? (
              <p className="text-steel-400">Carregando estrutura...</p>
            ) : bomTree?.length > 0 ? (
              <div className="space-y-2">
                {bomTree.map((item, idx) => (
                  <div key={idx} style={{ paddingLeft: \`\${(item.level - 1) * 2}rem\` }} className="flex items-center gap-4 py-2 border-b border-surface-100 last:border-0">
                    <div className="w-2 h-2 rounded-full bg-steel-300"></div>
                    <div className="flex-1">
                      <p className="font-bold text-steel-700">{item.child_code} - {item.child_name}</p>
                      <p className="text-xs text-steel-400">Qtd Necessária: {item.quantity_required} {item.unidade}</p>
                    </div>
                    {item.level === 1 && (
                       <button onClick={() => removeDependency.mutate(item.id)} className="p-2 text-red-500 hover:bg-red-50 rounded">
                         <Trash2 className="w-4 h-4" />
                       </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-8 bg-surface-50 rounded-lg">
                <AlertCircle className="w-8 h-8 text-steel-400 mx-auto mb-2" />
                <p className="text-steel-500">Nenhum componente cadastrado para este produto.</p>
              </div>
            )}
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-surface-200">
            <h2 className="text-lg font-bold text-steel-800 mb-4">Adicionar Componente</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              addDependency.mutate({
                parent_item_id: produtoId,
                child_item_id: formData.get('child_item_id'),
                quantity_required: parseFloat(formData.get('quantity_required'))
              });
              e.target.reset();
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-steel-700 mb-1">Insumo / Submontagem</label>
                <select name="child_item_id" required className="input-base w-full">
                  <option value="">Selecione...</option>
                  {produtos?.filter(p => p.id !== produtoId).map(p => (
                    <option key={p.id} value={p.id}>{p.codigo} - {p.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-steel-700 mb-1">Quantidade Necessária</label>
                <input name="quantity_required" type="number" step="0.0001" min="0.0001" required className="input-base w-full" />
              </div>
              <button type="submit" disabled={addDependency.isLoading} className="btn-primary w-full justify-center">
                <Plus className="w-4 h-4" /> Adicionar Relacionamento
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
