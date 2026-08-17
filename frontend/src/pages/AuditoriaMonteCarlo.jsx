import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Activity, Play, RefreshCw, ChevronDown, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import api from '../services/api';
import { formatNumber } from '../utils/formatters';

// Cores por classe ABC
const ABC_COLOR = { A: '#f59e0b', B: '#3b82f6', C: '#6b7280' };

const StatusBadge = ({ status }) => {
  const cfg = {
    queued:    { bg: 'bg-gray-700', text: 'text-gray-300', label: 'Na fila' },
    running:   { bg: 'bg-blue-900/50', text: 'text-blue-300', label: 'Executando...' },
    completed: { bg: 'bg-green-900/50', text: 'text-green-300', label: 'Concluído' },
    failed:    { bg: 'bg-red-900/50', text: 'text-red-300', label: 'Erro' },
  }[status] || { bg: 'bg-gray-700', text: 'text-gray-300', label: status };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {status === 'running' && <RefreshCw size={10} className="animate-spin" />}
      {status === 'completed' && <CheckCircle2 size={10} />}
      {status === 'failed' && <AlertCircle size={10} />}
      {status === 'queued' && <Clock size={10} />}
      {cfg.label}
    </span>
  );
};

const Histogram = ({ data }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(b => b.count));
  return (
    <div className="mt-4">
      <p className="text-xs text-gray-400 mb-2">Distribuição da Demanda Durante Lead Time</p>
      <div className="flex items-end gap-1 h-24">
        {data.map((bin, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-sm bg-blue-500/60 hover:bg-blue-400 transition-all"
              style={{ height: `${max > 0 ? (bin.count / max) * 88 : 0}px` }}
              title={`${bin.binStart}–${bin.binEnd}: ${bin.count}`}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-gray-500 mt-1">
        <span>{data[0]?.binStart.toFixed(0)}</span>
        <span>{data[data.length - 1]?.binEnd.toFixed(0)}</span>
      </div>
    </div>
  );
};

const AuditoriaMonteCarlo = () => {
  const [selectedSku, setSelectedSku] = useState('');
  const [runId, setRunId] = useState(null);
  const [runResult, setRunResult] = useState(null);
  const [poolInterval, setPoolInterval] = useState(null);
  const intervalRef = useRef(null);

  // Buscar lista de produtos com parâmetros calculados
  const { data: produtos, isLoading: loadProdutos } = useQuery({
    queryKey: ['mc-produtos'],
    queryFn: async () => {
      const res = await api.get('/produtos?limit=200&com_kanban=true');
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
  });

  // Histórico de runs para o SKU selecionado
  const { data: historico, refetch: refetchHistorico } = useQuery({
    queryKey: ['mc-historico', selectedSku],
    queryFn: async () => {
      if (!selectedSku) return [];
      const res = await api.get(`/simulations/sku/${selectedSku}`);
      return res.data || [];
    },
    enabled: !!selectedSku,
  });

  // Mutation para disparar simulação
  const startSim = useMutation({
    mutationFn: async () => {
      const res = await api.post('/simulations/run', { sku_id: selectedSku, n_simulations: 10000 });
      return res.data;
    },
    onSuccess: (data) => {
      setRunId(data.run_id);
      setRunResult(null);
      // Poll por resultado
      intervalRef.current = setInterval(async () => {
        try {
          const res = await api.get(`/simulations/${data.run_id}`);
          const run = res.data;
          if (run.status === 'completed' || run.status === 'failed') {
            setRunResult(run);
            clearInterval(intervalRef.current);
            refetchHistorico();
          }
        } catch (_) {}
      }, 2000);
    },
  });

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const selectedProduto = produtos?.find(p => p.id === selectedSku);
  const result = runResult?.result_json || null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-600/20 border border-blue-500/30">
          <Activity size={22} className="text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Auditoria Monte Carlo</h1>
          <p className="text-sm text-gray-400">Valide os parâmetros Kanban com simulação estocástica</p>
        </div>
      </div>

      {/* Controles */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-400 mb-1.5">SKU / Produto</label>
            <div className="relative">
              <select
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white appearance-none focus:outline-none focus:border-blue-500 transition-colors"
                value={selectedSku}
                onChange={e => { setSelectedSku(e.target.value); setRunId(null); setRunResult(null); }}
              >
                <option value="">Selecione um produto...</option>
                {(produtos || []).map(p => (
                  <option key={p.id} value={p.id}>
                    [{p.classificacao_abc || '?'}] {p.nome} — {p.codigo || p.id.slice(0, 8)}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex items-end">
            <button
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
              disabled={!selectedSku || startSim.isPending}
              onClick={() => startSim.mutate()}
            >
              {startSim.isPending ? <RefreshCw size={15} className="animate-spin" /> : <Play size={15} />}
              {startSim.isPending ? 'Disparando...' : 'Simular (10 000 runs)'}
            </button>
          </div>
        </div>

        {/* Info rápida do SKU */}
        {selectedProduto && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-gray-700">
            {[
              { label: 'Classe ABC', value: selectedProduto.classificacao_abc || '—', color: ABC_COLOR[selectedProduto.classificacao_abc] },
              { label: 'Estoque Atual', value: formatNumber(selectedProduto.estoque_atual) },
              { label: 'ES (Kanban)', value: formatNumber(selectedProduto.kanban?.estoque_seguranca ?? selectedProduto.estoque_seguranca) },
              { label: 'PR (Kanban)', value: formatNumber(selectedProduto.kanban?.ponto_reposicao ?? selectedProduto.ponto_reposicao) },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-900/60 rounded-lg p-3">
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-lg font-bold" style={{ color: color || '#f9fafb' }}>{value ?? '—'}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resultado em tempo real */}
      {runId && (
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Resultado da Simulação</h2>
            {runResult ? <StatusBadge status={runResult.status} /> : <StatusBadge status="running" />}
          </div>

          {!runResult && (
            <div className="flex items-center gap-3 text-gray-400 text-sm">
              <RefreshCw size={14} className="animate-spin" />
              Processando 10.000 iterações nas threads de fundo...
            </div>
          )}

          {runResult?.status === 'failed' && (
            <div className="text-red-400 text-sm flex items-center gap-2">
              <AlertCircle size={16} /> {runResult.error_message || 'Erro desconhecido'}
            </div>
          )}

          {runResult?.status === 'completed' && result && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Nível de serviço por ciclo', value: `${((result.cycleServiceLevelSimulated ?? result.fillRateSimulated) * 100).toFixed(2)}%`, alert: (result.cycleServiceLevelSimulated ?? result.fillRateSimulated) < 0.90 },
                  { label: 'Nível teórico', value: `${((result.cycleServiceLevelTheoretical ?? result.fillRateTheorical) * 100).toFixed(2)}%` },
                  { label: 'Probabilidade de ruptura', value: `${((result.stockoutProbability ?? result.stockoutRisk) * 100).toFixed(2)}%`, alert: (result.stockoutProbability ?? result.stockoutRisk) > 0.10 },
                  { label: 'ES Empírico (P95)', value: formatNumber(result.esSugerido) },
                ].map(({ label, value, alert }) => (
                  <div key={label} className={`rounded-lg p-3 border ${alert ? 'bg-red-900/20 border-red-500/40' : 'bg-gray-900/60 border-gray-700'}`}>
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className={`text-xl font-bold ${alert ? 'text-red-400' : 'text-white'}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Convergência */}
              <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${result.convergiu ? 'bg-green-900/20 text-green-300 border border-green-500/30' : 'bg-amber-900/20 text-amber-300 border border-amber-500/30'}`}>
                {result.convergiu ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                {result.convergiu
                  ? 'Modelo convergiu: fill rate simulado está dentro de ±2% do teórico.'
                  : 'Atenção: divergência entre fill rate simulado e teórico > 2%. Revise os parâmetros.'}
              </div>

              {/* Histograma */}
              <Histogram data={result.histogram} />

              <p className="text-xs text-gray-500">{result.nSimulations?.toLocaleString()} iterações · CV confidence: {runResult.cv_confidence || 'N/A'}</p>
            </div>
          )}
        </div>
      )}

      {/* Histórico */}
      {selectedSku && historico && historico.length > 0 && (
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-3">Histórico de Simulações</h2>
          <div className="space-y-2">
            {historico.map(run => (
              <div key={run.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-900/40 text-sm">
                <div className="flex items-center gap-3">
                  <StatusBadge status={run.status} />
                  <span className="text-gray-400 text-xs">{new Date(run.started_at).toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex items-center gap-4 text-right">
                  {run.fill_rate_simulated && (
                    <span className="text-white font-semibold">{(run.fill_rate_simulated * 100).toFixed(2)}%</span>
                  )}
                  <span className="text-gray-500 text-xs">{run.n_simulations?.toLocaleString()} runs</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditoriaMonteCarlo;
