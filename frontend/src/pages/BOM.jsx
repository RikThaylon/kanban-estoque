import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { AlertCircle, Plus, Trash2, Network, ChevronRight } from 'lucide-react';

function BomNode({ item, produtos, onDelete, canDelete }) {
  const [open, setOpen] = useState(true);
  const indent = (item.level || 1) - 1;

  return (
    <div style={{ marginLeft: `${indent * 1.5}rem` }}>
      <div className={`flex items-center gap-3 py-2 px-3 rounded-lg group transition-colors hover:bg-surface-50 ${indent === 0 ? 'border-b border-surface-100' : ''}`}>
        <div className={`w-2 h-2 rounded-full shrink-0 ${indent === 0 ? 'bg-brand-500' : 'bg-steel-300'}`} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-steel-700 truncate">{item.child_code} — {item.child_name}</p>
          <p className="text-xs text-steel-400">
            Qtd necessária: <span className="font-medium text-steel-600">{parseFloat(item.quantity_required).toFixed(4)} {item.unidade}</span>
            <span className="mx-2 text-steel-200">|</span>
            <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
              item.child_category === 'machine_mro'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-brand-100 text-brand-700'
            }`}>
              {item.child_category === 'machine_mro' ? 'MRO' : 'BOM'}
            </span>
          </p>
        </div>
        {canDelete && indent === 0 && (
          <button
            onClick={() => { if (confirm(`Remover ${item.child_code} do BOM?`)) onDelete(item.id); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-red-500 hover:bg-red-50 rounded"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function BOM() {
  const queryClient = useQueryClient();
  const [produtoId, setProdutoId] = useState('');
  const [addForm, setAddForm] = useState({ child_item_id: '', quantity_required: '' });
  const [formError, setFormError] = useState('');

  const { data: produtos, isLoading: loadingProdutos } = useQuery({
    queryKey: ['produtos_bom'],
    queryFn: async () => {
      const res = await api.get('/produtos?limit=200');
      return res.data.data || [];
    }
  });

  const { data: bomTree, isLoading: loadingTree } = useQuery({
    queryKey: ['bom', produtoId],
    queryFn: async () => {
      const res = await api.get(`/bom/${produtoId}`);
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    },
    enabled: !!produtoId
  });

  const addDependency = useMutation({
    mutationFn: (data) => api.post('/bom', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['bom', produtoId]);
      setAddForm({ child_item_id: '', quantity_required: '' });
      setFormError('');
    },
    onError: (err) => {
      setFormError(err.response?.data?.message || 'Erro ao adicionar relacionamento. Verifique ciclos.');
    }
  });

  const removeDependency = useMutation({
    mutationFn: (id) => api.delete(`/bom/${id}`),
    onSuccess: () => queryClient.invalidateQueries(['bom', produtoId])
  });

  const selectedProduct = produtos?.find(p => p.id === produtoId);
  const childIds = bomTree?.map(b => b.child_item_id) || [];
  const availableForAdd = (produtos || []).filter(p => p.id !== produtoId && !childIds.includes(p.id));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-steel-800 flex items-center gap-2">
          <Network className="w-6 h-6 text-brand-500" /> Bill of Materials (BOM)
        </h1>
        <p className="text-sm text-steel-400 mt-1">
          Gerencie a estrutura de composição dos seus produtos finais. Detecção de ciclos automática via CTE recursiva (PostgreSQL).
        </p>
      </div>

      {/* Seletor de Produto */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-surface-200">
        <label className="block text-sm font-bold text-steel-700 mb-2">Produto Principal (Produto Final / Submontagem)</label>
        <select
          className="input-base w-full max-w-lg"
          value={produtoId}
          onChange={(e) => setProdutoId(e.target.value)}
          disabled={loadingProdutos}
        >
          <option value="">
            {loadingProdutos ? 'Carregando...' : 'Selecione um produto para ver sua estrutura...'}
          </option>
          {(produtos || []).map(p => (
            <option key={p.id} value={p.id}>
              [{p.category === 'machine_mro' ? 'MRO' : 'BOM'}] {p.codigo} — {p.nome}
            </option>
          ))}
        </select>
      </div>

      {produtoId && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Árvore BOM */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-surface-200">
            <div className="p-4 border-b border-surface-100 flex items-center justify-between">
              <h2 className="font-bold text-steel-800">
                Estrutura de: <span className="text-brand-600">{selectedProduct?.codigo} — {selectedProduct?.nome}</span>
              </h2>
              <span className="text-xs text-steel-400 bg-surface-100 px-2 py-1 rounded">
                {bomTree?.length || 0} componentes diretos
              </span>
            </div>
            <div className="p-4">
              {loadingTree ? (
                <p className="text-steel-400 text-center py-8">Carregando estrutura...</p>
              ) : !bomTree || bomTree.length === 0 ? (
                <div className="text-center py-10 bg-surface-50 rounded-lg">
                  <AlertCircle className="w-8 h-8 text-steel-300 mx-auto mb-2" />
                  <p className="text-steel-500 font-medium">Sem componentes cadastrados</p>
                  <p className="text-xs text-steel-400 mt-1">Use o painel ao lado para adicionar o primeiro insumo.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {bomTree.map((item, idx) => (
                    <BomNode
                      key={`${item.id}-${idx}`}
                      item={item}
                      produtos={produtos}
                      onDelete={(id) => removeDependency.mutate(id)}
                      canDelete={true}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Adicionar Componente */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-surface-200 h-fit">
            <h2 className="text-lg font-bold text-steel-800 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-brand-500" />
              Adicionar Componente
            </h2>

            <form onSubmit={(e) => {
              e.preventDefault();
              setFormError('');
              addDependency.mutate({
                parent_item_id: produtoId,
                child_item_id: addForm.child_item_id,
                quantity_required: parseFloat(addForm.quantity_required)
              });
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-steel-700 mb-1">Insumo / Submontagem</label>
                <select
                  required
                  className="input-base w-full"
                  value={addForm.child_item_id}
                  onChange={e => setAddForm({ ...addForm, child_item_id: e.target.value })}
                >
                  <option value="">Selecione o componente...</option>
                  {availableForAdd.map(p => (
                    <option key={p.id} value={p.id}>
                      [{p.category === 'machine_mro' ? 'MRO' : 'BOM'}] {p.codigo} — {p.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-steel-700 mb-1">Qtd. Necessária por Unidade do Pai</label>
                <input
                  name="quantity_required"
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  required
                  className="input-base w-full"
                  value={addForm.quantity_required}
                  onChange={e => setAddForm({ ...addForm, quantity_required: e.target.value })}
                  placeholder="Ex: 4.0000"
                />
              </div>

              {formError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={addDependency.isLoading}
                className="btn-primary w-full justify-center"
              >
                {addDependency.isLoading ? 'Adicionando...' : (
                  <><Plus className="w-4 h-4" /> Adicionar Relacionamento</>
                )}
              </button>
            </form>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <p className="text-xs text-blue-700">
                💡 <strong>Detecção de Ciclos:</strong> O sistema impede automaticamente que você crie relações circulares (ex: A → B → A) via CTE recursiva no banco.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
