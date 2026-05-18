import React, { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const formatValue = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(number);
};

const buildLinearCycleData = ({ cmd, leadTime, es, pr, emax, ciclos }) => {
  const diasConsumo = Math.max((emax - pr) / cmd, 1);
  const reposicaoDias = Math.max(1, Math.min(leadTime || 1, 2));
  const rows = [];
  let dia = 0;

  for (let ciclo = 1; ciclo <= ciclos; ciclo += 1) {
    const inicio = dia;
    const diaPedido = inicio + diasConsumo;
    const diaChegada = diaPedido + leadTime;
    const diaReposicao = diaChegada + reposicaoDias;
    const estoqueChegada = Math.max(pr - cmd * leadTime, Math.max(es * 0.7, 0));

    rows.push({ dia: inicio, estoqueEstimado: emax, evento: `Inicio ciclo ${ciclo}` });
    rows.push({ dia: diaPedido, estoqueEstimado: pr, evento: 'Ponto de reposicao' });
    rows.push({ dia: diaChegada, estoqueEstimado: estoqueChegada, evento: 'Chegada do pedido' });
    rows.push({ dia: diaReposicao, estoqueEstimado: emax, evento: 'Reposicao concluida' });

    dia = diaReposicao;
  }

  return rows;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const visible = payload.filter(item => item.value !== null && item.value !== undefined);
  if (!visible.length) return null;

  const event = visible.find(item => item.payload?.evento)?.payload?.evento;

  return (
    <div className="rounded-md border border-steel-700/15 bg-white px-3 py-2 shadow-panel text-xs">
      <div className="font-bold text-steel-900 mb-1">Dia {formatValue(label)}</div>
      {event && <div className="text-steel-500 mb-1">{event}</div>}
      <div className="space-y-1">
        {visible.map(item => (
          <div key={item.dataKey} className="flex items-center justify-between gap-4">
            <span className="font-medium" style={{ color: item.color }}>{item.name}</span>
            <span className="font-bold text-steel-800">{formatValue(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const KanbanSawtoothChart = ({
  cmd = 0,
  leadTime = 0,
  es = 0,
  pr = 0,
  emax = 0,
  ciclos = 3,
  historico = [],
  height = 220,
}) => {
  const valido = cmd > 0 && leadTime >= 0 && emax > 0 && pr > 0;

  const { data, yMax } = useMemo(() => {
    if (!valido) return { data: [], yMax: 100 };

    const estimated = buildLinearCycleData({ cmd, leadTime, es, pr, emax, ciclos });
    const byDay = new Map();

    estimated.forEach(row => {
      byDay.set(row.dia, {
        ...(byDay.get(row.dia) || {}),
        ...row,
      });
    });

    historico.forEach(point => {
      const dia = Number(point.dia);
      if (!Number.isFinite(dia)) return;
      byDay.set(dia, {
        ...(byDay.get(dia) || { dia }),
        estoqueReal: Number(point.estoque),
      });
    });

    const rows = Array.from(byDay.values()).sort((a, b) => a.dia - b.dia);
    const values = rows.flatMap(row => [row.estoqueEstimado, row.estoqueReal]).filter(Number.isFinite);
    return {
      data: rows,
      yMax: Math.max(emax, pr, es, ...values) * 1.12,
    };
  }, [cmd, leadTime, es, pr, emax, ciclos, historico, valido]);

  if (!valido) {
    return (
      <div
        className="flex items-center justify-center industrial-surface border border-dashed border-steel-300 rounded-md p-6 text-center text-steel-500 text-sm"
        style={{ minHeight: height }}
      >
        <div>
          <div className="font-bold text-steel-700">Dados Kanban incompletos</div>
          <div className="text-xs mt-1 opacity-80">Informe consumo diario, lead time, PR e estoque maximo.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-md border border-steel-700/15 bg-white/90 shadow-panel">
      <div className="h-[260px] sm:h-[320px] w-full p-2 sm:p-4" style={{ minHeight: height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D4DDD6" />
            <ReferenceArea y1={0} y2={es} fill="#FEE2E2" fillOpacity={0.55} />
            <ReferenceArea y1={es} y2={pr} fill="#FEF3C7" fillOpacity={0.55} />
            <ReferenceArea y1={pr} y2={emax} fill="#D1FAE5" fillOpacity={0.45} />
            <ReferenceLine y={es} stroke="#DC2626" strokeDasharray="5 5" label={{ value: 'ES', fill: '#DC2626', fontSize: 11 }} />
            <ReferenceLine y={pr} stroke="#B45309" strokeDasharray="5 5" label={{ value: 'PR', fill: '#B45309', fontSize: 11 }} />
            <ReferenceLine y={emax} stroke="#1A5C36" strokeDasharray="5 5" label={{ value: 'EM', fill: '#1A5C36', fontSize: 11 }} />
            <XAxis
              dataKey="dia"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(value) => `${Math.round(value)}d`}
              tick={{ fill: '#5D716B', fontSize: 11, fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, yMax]}
              tickFormatter={formatValue}
              tick={{ fill: '#5D716B', fontSize: 11, fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#102322', strokeDasharray: '4 4' }} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Line
              name="Estoque estimado"
              type="linear"
              dataKey="estoqueEstimado"
              stroke="#102322"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
            <Line
              name="Estoque real"
              type="linear"
              dataKey="estoqueReal"
              stroke="#2D6CDF"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:justify-center gap-2 sm:gap-4 px-3 pb-3 text-[11px] sm:text-xs text-steel-500 border-t border-steel-700/10 pt-2">
        <span><strong>ES={formatValue(es)}</strong> seguranca</span>
        <span><strong>PR={formatValue(pr)}</strong> reposicao</span>
        <span><strong>EM={formatValue(emax)}</strong> maximo</span>
        <span><strong>CMD={formatValue(cmd)}/dia</strong></span>
        <span><strong>LT={formatValue(leadTime)} dias</strong></span>
      </div>
    </div>
  );
};

export default KanbanSawtoothChart;
