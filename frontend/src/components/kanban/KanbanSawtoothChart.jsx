import React, { useMemo } from 'react';

/**
 * KanbanSawtoothChart — Gráfico de dente de serra do Kanban
 *
 * Props:
 *   cmd        — consumo médio diário (unidades/dia)
 *   leadTime   — prazo de entrega em dias
 *   es         — estoque de segurança
 *   pr         — ponto de reposição
 *   emax       — estoque máximo (= ES + EOQ)
 *   ciclos     — nº de ciclos a desenhar (3 ou 6)
 *   historico  — array [{dia, estoque}] de pontos reais (opcional)
 *   height     — altura do SVG (default 220)
 */
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
  const W = 600;
  const H = height;
  const PAD = { top: 20, right: 24, bottom: 40, left: 52 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const valido = cmd > 0 && leadTime >= 0 && emax > 0 && pr > 0;

  const { points, totalDias, yMax } = useMemo(() => {
    if (!valido) return { points: [], totalDias: 0, yMax: 100 };

    const yMax = emax * 1.08;
    // Duração de um ciclo: do Emax até atingir PR (consumo), então Lead Time de espera, reposição
    const diasConsumo = Math.max((emax - pr) / cmd, 1); // dias para ir de Emax→PR
    const cicloTotal = diasConsumo + leadTime;
    const totalDias = cicloTotal * ciclos;

    const pts = [];
    let dia = 0;
    let estoque = emax;

    for (let c = 0; c < ciclos; c++) {
      // Ponto de início do ciclo (Emax)
      pts.push({ dia, estoque, tipo: 'normal' });

      // Descida linear até PR
      const diaAtingePR = dia + diasConsumo;
      pts.push({ dia: diaAtingePR, estoque: pr, tipo: 'pr' });

      // Durante lead time continua caindo até ES (ou um pouco abaixo)
      const estoqueAoChegar = Math.max(pr - cmd * leadTime, es * 0.7);
      const diaChegada = diaAtingePR + leadTime;
      pts.push({ dia: diaChegada, estoque: estoqueAoChegar, tipo: 'chegada' });

      // Reposição instantânea de volta ao Emax
      pts.push({ dia: diaChegada, estoque: emax, tipo: 'reposicao' });

      dia = diaChegada;
      estoque = emax;
    }

    return { points: pts, totalDias, yMax };
  }, [cmd, leadTime, es, pr, emax, ciclos, valido]);

  const toX = (dia) => PAD.left + (dia / totalDias) * chartW;
  const toY = (val) => PAD.top + chartH - (val / yMax) * chartH;

  // Polyline string
  const polyline = points.map(p => `${toX(p.dia).toFixed(1)},${toY(p.estoque).toFixed(1)}`).join(' ');

  // Faixas horizontais
  const yES = toY(es);
  const yPR = toY(pr);
  const yEM = toY(emax);
  const yZero = toY(0);
  const xStart = PAD.left;
  const xEnd = PAD.left + chartW;

  if (!valido) {
    return (
      <div className="flex items-center justify-center bg-surface-50 border border-dashed border-surface-300 rounded-xl p-6 text-center text-navy-400 text-sm" style={{ height }}>
        <div>
          <div className="text-2xl mb-2">📈</div>
          <div className="font-medium">Preencha o Consumo Diário e o Lead Time</div>
          <div className="text-xs mt-1 opacity-70">O gráfico aparecerá automaticamente</div>
        </div>
      </div>
    );
  }

  const labelStyle = { fontSize: 10, fill: '#64748b', fontFamily: 'monospace' };

  // Pontos de PR (onde dispara reposição) para linha tracejada vertical
  const prPoints = points.filter(p => p.tipo === 'pr');

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-surface-200 bg-white shadow-sm">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-label="Gráfico Kanban Serrote">
        <defs>
          <clipPath id="chart-clip">
            <rect x={PAD.left} y={PAD.top} width={chartW} height={chartH} />
          </clipPath>
        </defs>

        {/* Faixas coloridas de fundo */}
        {/* Vermelho: 0 → ES */}
        <rect x={xStart} y={yES} width={chartW} height={yZero - yES}
          fill="#fee2e2" opacity="0.6" clipPath="url(#chart-clip)" />
        {/* Amarelo: ES → PR */}
        <rect x={xStart} y={yPR} width={chartW} height={yES - yPR}
          fill="#fef9c3" opacity="0.6" clipPath="url(#chart-clip)" />
        {/* Verde: PR → Emax */}
        <rect x={xStart} y={yEM} width={chartW} height={yPR - yEM}
          fill="#dcfce7" opacity="0.6" clipPath="url(#chart-clip)" />

        {/* Grid linhas horizontais */}
        {[es, pr, emax].map((v, i) => (
          <line key={i}
            x1={xStart} x2={xEnd}
            y1={toY(v)} y2={toY(v)}
            stroke={['#ef4444', '#f59e0b', '#22c55e'][i]}
            strokeWidth="1.2" strokeDasharray="5,4" opacity="0.8"
          />
        ))}

        {/* Linhas verticais de reposição */}
        {prPoints.map((p, i) => {
          const chegada = points.find(pt => pt.tipo === 'chegada' && pt.dia > p.dia);
          if (!chegada) return null;
          return (
            <line key={i}
              x1={toX(chegada.dia)} x2={toX(chegada.dia)}
              y1={toY(chegada.estoque)} y2={toY(emax)}
              stroke="#6366f1" strokeWidth="1.5" strokeDasharray="3,3" opacity="0.7"
              clipPath="url(#chart-clip)"
            />
          );
        })}

        {/* Linha do serrote */}
        <polyline
          points={polyline}
          fill="none"
          stroke="#1e3a5f"
          strokeWidth="2.2"
          strokeLinejoin="round"
          clipPath="url(#chart-clip)"
        />

        {/* Pontos históricos reais */}
        {historico.map((pt, i) => (
          <circle key={i}
            cx={toX(pt.dia)} cy={toY(pt.estoque)}
            r="3" fill="#6366f1" opacity="0.8"
            clipPath="url(#chart-clip)"
          />
        ))}

        {/* Labels das faixas (direita do gráfico) */}
        <text x={xEnd + 3} y={toY(emax) + 4} style={{ ...labelStyle, fill: '#16a34a', fontSize: 9, fontWeight: 'bold' }}>EM</text>
        <text x={xEnd + 3} y={toY(pr) + 4} style={{ ...labelStyle, fill: '#d97706', fontSize: 9, fontWeight: 'bold' }}>PR</text>
        <text x={xEnd + 3} y={toY(es) + 4} style={{ ...labelStyle, fill: '#dc2626', fontSize: 9, fontWeight: 'bold' }}>ES</text>

        {/* Eixo Y — valores */}
        {[0, es, pr, emax].map((v, i) => (
          <text key={i} x={PAD.left - 4} y={toY(v) + 4} textAnchor="end" style={labelStyle}>
            {Number(v.toFixed(1))}
          </text>
        ))}

        {/* Eixo X — dias */}
        {Array.from({ length: ciclos + 1 }).map((_, i) => {
          const diasConsumo = Math.max((emax - pr) / cmd, 1);
          const cicloTotal = diasConsumo + leadTime;
          const dia = i * cicloTotal;
          return (
            <text key={i} x={toX(dia)} y={H - PAD.bottom + 14} textAnchor="middle" style={labelStyle}>
              {Math.round(dia)}d
            </text>
          );
        })}

        {/* Eixo Y linha */}
        <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + chartH} stroke="#cbd5e1" strokeWidth="1" />
        {/* Eixo X linha */}
        <line x1={PAD.left} x2={xEnd} y1={PAD.top + chartH} y2={PAD.top + chartH} stroke="#cbd5e1" strokeWidth="1" />

        {/* Título eixo Y */}
        <text x={12} y={PAD.top + chartH / 2} transform={`rotate(-90, 12, ${PAD.top + chartH / 2})`}
          textAnchor="middle" style={{ ...labelStyle, fontSize: 9 }}>Qtd. em estoque</text>

        {/* Legenda */}
        <g transform={`translate(${PAD.left + 8}, ${PAD.top + 4})`}>
          <rect width="9" height="9" fill="#fee2e2" stroke="#ef4444" strokeWidth="0.5" rx="1" />
          <text x="12" y="8" style={{ ...labelStyle, fontSize: 9 }}>Crítico (abaixo do ES)</text>
          <rect x="100" width="9" height="9" fill="#fef9c3" stroke="#f59e0b" strokeWidth="0.5" rx="1" />
          <text x="112" y="8" style={{ ...labelStyle, fontSize: 9 }}>Atenção (ES→PR)</text>
          <rect x="196" width="9" height="9" fill="#dcfce7" stroke="#22c55e" strokeWidth="0.5" rx="1" />
          <text x="208" y="8" style={{ ...labelStyle, fontSize: 9 }}>Normal (PR→EM)</text>
        </g>

        {/* Texto "Reposição" nas linhas verticais */}
        {prPoints.slice(0, 3).map((p, i) => {
          const chegada = points.find(pt => pt.tipo === 'chegada' && pt.dia > p.dia);
          if (!chegada) return null;
          const midX = toX((p.dia + chegada.dia) / 2);
          return (
            <text key={i} x={midX} y={PAD.top + 14} textAnchor="middle"
              style={{ fontSize: 8, fill: '#6366f1', fontFamily: 'sans-serif' }}>
              ↑ pedido
            </text>
          );
        })}
      </svg>

      {/* Legenda resumo abaixo */}
      <div className="flex flex-wrap justify-center gap-4 px-4 pb-3 text-xs text-navy-500 border-t border-surface-100 pt-2">
        <span>🔴 <strong>ES={Number(es.toFixed(1))}</strong> — Estoque de Segurança</span>
        <span>🟡 <strong>PR={Number(pr.toFixed(1))}</strong> — Ponto de Reposição</span>
        <span>🟢 <strong>EM={Number(emax.toFixed(1))}</strong> — Estoque Máximo</span>
        <span>📦 <strong>CMD={Number(cmd.toFixed(1))}/dia</strong></span>
        <span>🚚 <strong>LT={Number(leadTime.toFixed(0))} dias</strong></span>
      </div>
    </div>
  );
};

export default KanbanSawtoothChart;
