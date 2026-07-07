import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../services/api';
import { Calculator, AlertTriangle, ShoppingCart, CheckCircle2 } from 'lucide-react';

export default function PCP() {
  const [targetProduct, setTargetProduct] = useState('');
  const [targetQuantity, setTargetQuantity] = useState('');
  const [explosionResults, setExplosionResults] = useState(null);

  const { data: produtos } = useQuery({
    queryKey: ['produtos_pcp'],
    queryFn: async () => (await api.get('/produtos?limit=100')).data.data
  });

  const explodeDemand = useMutation({
    mutationFn: (targets) => api.post('/pcp/explode', { targets }),
    onSuccess: (res) => setExplosionResults(res.data.data)
  });

  const handleExplode = (e) => {
    e.preventDefault();
    explodeDemand.mutate([{ productId: targetProduct, quantity: parseFloat(targetQuantity) }]);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-steel-800 mb-6">PCP - Planejamento e Explosão de Demanda (MRP)</h1>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-surface-200 mb-6">
        <form onSubmit={handleExplode} className="flex flex-col md:flex-row items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-bold text-steel-700 mb-2">Meta de Produção (Produto Final)</label>
            <select 
              required
              className="input-base w-full"
              value={targetProduct}
              onChange={(e) => setTargetProduct(e.target.value)}
            >
              <option value="">Selecione um produto final...</option>
              {produtos?.filter(p => p.category !== 'machine_mro').map(p => (
                <option key={p.id} value={p.id}>{p.codigo} - {p.nome}</option>
              ))}
            </select>
          </div>
          <div className="w-48">
            <label className="block text-sm font-bold text-steel-700 mb-2">Quantidade Mensal</label>
            <input 
              required type="number" min="1" step="1"
              className="input-base w-full"
              value={targetQuantity}
              onChange={(e) => setTargetQuantity(e.target.value)}
            />
          </div>
          <button type="submit" disabled={explodeDemand.isLoading} className="btn-primary">
            <Calculator className="w-5 h-5 mr-2" />
            Explodir BOM
          </button>
        </form>
      </div>

      {explosionResults && (
        <div className="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden">
          <div className="p-4 bg-surface-50 border-b border-surface-200">
            <h2 className="text-lg font-bold text-steel-800">Necessidades de Materiais (Net Demand)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-200 text-xs font-bold text-steel-400 uppercase tracking-wider">
                  <th className="p-4">Item</th>
                  <th className="p-4 text-right">Demanda Bruta</th>
                  <th className="p-4 text-right text-blue-600">Estoque Atual</th>
                  <th className="p-4 text-right text-amber-600">Em Trânsito</th>
                  <th className="p-4 text-right font-bold text-red-600">Necessidade (Comprar)</th>
                  <th className="p-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {explosionResults.map((row) => (
                  <tr key={row.produto_id} className="hover:bg-surface-50 transition-colors">
                    <td className="p-4 font-bold text-steel-700">{row.codigo} - {row.nome}</td>
                    <td className="p-4 text-right">{row.demanda_bruta.toFixed(2)}</td>
                    <td className="p-4 text-right text-blue-600">{row.estoque_atual.toFixed(2)}</td>
                    <td className="p-4 text-right text-amber-600">{row.em_transito.toFixed(2)}</td>
                    <td className="p-4 text-right font-bold text-red-600">{row.demanda_liquida.toFixed(2)}</td>
                    <td className="p-4 text-center">
                      {row.critico ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                          <AlertTriangle className="w-3 h-3" /> Faltante
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="w-3 h-3" /> OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-surface-50 border-t border-surface-200 text-right">
             <button className="btn-secondary">
               <ShoppingCart className="w-4 h-4 mr-2" />
               Gerar Sugestões de Compra
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
