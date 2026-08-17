import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatNumber } from '../../utils/formatters';

const percent = (value) => Number.isFinite(Number(value))
  ? `${(Number(value) * 100).toFixed(1)}%`
  : '—';

const metric = (value) => Number.isFinite(Number(value))
  ? Number(value).toFixed(3)
  : '—';

export default function ForecastDetails({ analysis, loading, error }) {
  const chartData = useMemo(() => {
    if (!analysis) return [];
    const history = (analysis.history || []).map(observation => ({
      date: observation.date,
      actual: Number(observation.value) || 0,
    }));
    const future = (analysis.forecast?.daily || []).map(point => ({
      date: point.date || `D+${point.period}`,
      forecast: point.expected,
      lower: point.lower,
      upper: point.upper,
    }));
    return [...history, ...future];
  }, [analysis]);

  if (loading) {
    return <div className="p-10 text-center text-steel-400 animate-pulse">Calculando previsão e backtest...</div>;
  }
  if (error) {
    return (
      <div className="card p-8 text-center text-red-600">
        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
        Não foi possível carregar a previsão: {error.message}
      </div>
    );
  }
  if (!analysis) return null;

  const selection = analysis.modelSelection || {};
  const profile = analysis.profile || {};
  const risk = analysis.inventoryRisk;
  const challengers = selection.challengers || [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-steel-400">Modelo campeão</p>
          <p className="text-xl font-black text-steel-800 mt-1">{selection.selected}</p>
          <p className="text-xs text-steel-500 mt-1">Confiança {analysis.confidence}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-steel-400">Demanda esperada</p>
          <p className="text-xl font-black text-steel-800 mt-1">{formatNumber(analysis.forecast?.expectedDailyDemand)} / dia</p>
          <p className="text-xs text-steel-500 mt-1">Horizonte: {analysis.forecast?.horizon} dias</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-steel-400">Risco de ruptura</p>
          <p className={`text-xl font-black mt-1 ${risk?.risk === 'HIGH' ? 'text-red-600' : risk?.risk === 'MEDIUM' ? 'text-amber-600' : 'text-emerald-600'}`}>
            {percent(risk?.stockoutProbability)}
          </p>
          <p className="text-xs text-steel-500 mt-1">Classificação {risk?.risk || 'indisponível'}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-steel-400">Demanda no lead time</p>
          <p className="text-xl font-black text-steel-800 mt-1">{formatNumber(risk?.expectedDemandDuringLeadTime)}</p>
          <p className="text-xs text-steel-500 mt-1">ES sugerido: {formatNumber(risk?.safetyStock)}</p>
        </div>
      </div>

      <div className="card p-4 sm:p-5">
        <div className="mb-4">
          <h3 className="font-bold text-steel-800">Realizado x previsão diária</h3>
          <p className="text-sm text-steel-400">Faixa P10–P90 estimada por bootstrap dos resíduos fora da amostra.</p>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ left: 4, right: 16, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" minTickGap={28} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => formatNumber(value)} />
              <Legend />
              <Line type="monotone" dataKey="actual" name="Realizado" stroke="#334155" dot={false} strokeWidth={2} connectNulls={false} />
              <Line type="monotone" dataKey="forecast" name="Previsão" stroke="#2563eb" dot={false} strokeWidth={2} connectNulls={false} />
              <Line type="monotone" dataKey="lower" name="P10" stroke="#93c5fd" dot={false} strokeDasharray="4 4" connectNulls={false} />
              <Line type="monotone" dataKey="upper" name="P90" stroke="#60a5fa" dot={false} strokeDasharray="4 4" connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-bold text-steel-800">Por que este modelo?</h3>
            <p className="text-sm text-steel-600 mt-1">{selection.reason}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5 text-sm">
          {[
            ['MAE', analysis.metrics?.mae],
            ['RMSE', analysis.metrics?.rmse],
            ['WAPE', analysis.metrics?.wape],
            ['Viés', analysis.metrics?.bias],
            ['MASE', analysis.metrics?.mase],
          ].map(([label, value]) => (
            <div key={label} className="bg-surface-50 border border-surface-200 rounded-lg p-3">
              <p className="text-xs text-steel-400">{label}</p>
              <p className="font-mono font-bold text-steel-700">{metric(value)}</p>
            </div>
          ))}
        </div>
      </div>

      <details className="card p-5">
        <summary className="cursor-pointer font-bold text-steel-800">Diagnóstico e challengers</summary>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-steel-400">Perfil</dt><dd className="font-bold">{profile.type}</dd>
            <dt className="text-steel-400">Observações</dt><dd>{profile.historyLength}</dd>
            <dt className="text-steel-400">ADI</dt><dd>{metric(profile.adi)}</dd>
            <dt className="text-steel-400">CV²</dt><dd>{metric(profile.cv2)}</dd>
            <dt className="text-steel-400">Tendência</dt><dd>{profile.trend?.detected ? `${profile.trend.direction} (${metric(profile.trend.normalizedSlope)})` : 'não detectada'}</dd>
            <dt className="text-steel-400">Sazonalidade</dt><dd>{profile.seasonality?.detected ? `${profile.seasonality.period} períodos` : 'não detectada'}</dd>
            <dt className="text-steel-400">Outliers</dt><dd>{profile.outliers?.length || 0} preservados</dd>
            <dt className="text-steel-400">Drift</dt><dd>{analysis.drift?.detected ? 'detectado' : 'não detectado'}</dd>
          </dl>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-steel-400"><th className="pb-2">Modelo</th><th>Score</th><th>WAPE</th><th>Folds</th></tr></thead>
              <tbody className="divide-y divide-surface-100">
                {[selection.champion, ...challengers].filter(Boolean).map((candidate, index) => (
                  <tr key={`${candidate.model}-${index}`}>
                    <td className="py-2 font-bold">{candidate.model}{index === 0 ? ' ★' : ''}</td>
                    <td>{metric(candidate.score)}</td>
                    <td>{metric(candidate.metrics?.wape)}</td>
                    <td>{candidate.folds}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-steel-400 mt-4">
          Versão {analysis.engineVersion} · Treinado até {analysis.trainedUntil || 'sem data'} ·
          zeros preenchidos: {profile.dataQuality?.zeroFilledPeriods ?? 0}.
        </p>
      </details>
    </div>
  );
}
