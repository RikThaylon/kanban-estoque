import React from 'react';
import { calculateZones } from '../../utils/kanban.utils';
import { formatNumber } from '../../utils/formatters';

const KanbanBar = ({ estoqueAtual, es, pr, emax, className = '' }) => {
  const zones = calculateZones(es, pr, emax);
  const max = emax || pr * 1.5 || 100;
  
  // Calcular posição do marcador (limitado entre 0% e 100%)
  const rawPercentage = max > 0 ? (estoqueAtual / max) * 100 : 0;
  const markerPosition = Math.min(Math.max(rawPercentage, 0), 100);
  
  // Definir cor e texto da faixa atual
  let faixaBadgeBg = 'bg-steel-700 text-white';
  let setaColor = 'border-t-steel-700';
  let statusTexto = 'Indefinido';

  if (es > 0 || pr > 0) {
    if (estoqueAtual <= es) {
      faixaBadgeBg = 'bg-red-600 text-white';
      setaColor = 'border-t-red-600';
      statusTexto = 'Vermelho (Abaixo do ES)';
    } else if (estoqueAtual <= pr) {
      faixaBadgeBg = 'bg-amber-600 text-white';
      setaColor = 'border-t-amber-600';
      statusTexto = 'Amarelo (Em Reposição)';
    } else {
      faixaBadgeBg = 'bg-emerald-600 text-white';
      setaColor = 'border-t-emerald-600';
      statusTexto = 'Verde (Confortável)';
    }
  }

  const esPos = zones[0]?.width || 0;
  const prPos = (zones[0]?.width || 0) + (zones[1]?.width || 0);

  return (
    <div className={`w-full py-2 px-1 ${className}`}>
      <div className="relative pt-7 pb-6">
        
        {/* Marcador Superior do Estoque Atual */}
        <div 
          className="absolute top-0 flex flex-col items-center -translate-x-1/2 z-20 transition-all duration-300 pointer-events-none" 
          style={{ left: `${markerPosition}%` }}
        >
          <div className={`px-2.5 py-1 rounded-full text-xs font-black shadow-md whitespace-nowrap flex items-center gap-1.5 ${faixaBadgeBg}`}>
            <span>Atual:</span>
            <span className="font-mono text-sm">{formatNumber(estoqueAtual)}</span>
          </div>
          <div className={`w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent ${setaColor} mt-[-1px]`}></div>
        </div>

        {/* Régua de Cores */}
        <div className="relative h-5 rounded-lg overflow-hidden flex shadow-sm border border-steel-300/40 bg-surface-100">
          <div className="h-full bg-kanban-vermelho/90 transition-all duration-300" style={{ width: `${zones[0].width}%` }} title={`Vermelho (ES): 0 a ${es}`}></div>
          <div className="h-full bg-kanban-amarelo/90 transition-all duration-300" style={{ width: `${zones[1].width}%` }} title={`Amarelo (PR): ${es} a ${pr}`}></div>
          <div className="h-full bg-kanban-verde/90 transition-all duration-300" style={{ width: `${zones[2].width}%` }} title={`Verde (Emax): > ${pr}`}></div>

          {/* Marcador de Linha no ponto do Estoque Atual */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-slate-900 shadow-md z-10 -translate-x-1/2"
            style={{ left: `${markerPosition}%` }}
          />
        </div>

        {/* Eixo X com valores e marcações estéticas */}
        <div className="relative h-7 mt-2 text-xs font-mono font-semibold text-steel-600 select-none">
          
          {/* Tick 0 */}
          <div className="absolute top-0 left-0 flex flex-col items-start">
            <div className="h-2 w-0.5 bg-steel-400 mb-0.5"></div>
            <span className="text-[11px] text-steel-500 font-bold">0</span>
          </div>
          
          {/* Tick ES */}
          {es > 0 && (
            <div className="absolute top-0 flex flex-col items-center -translate-x-1/2" style={{ left: `${esPos}%` }}>
              <div className="h-2 w-0.5 bg-red-500 mb-0.5"></div>
              <span className="text-[11px] font-bold text-red-700 bg-red-50 px-1 rounded border border-red-200 shadow-2xs">
                {formatNumber(es)} <span className="text-[9px] text-red-500 font-normal">ES</span>
              </span>
            </div>
          )}
          
          {/* Tick PR */}
          {pr > 0 && (
            <div className="absolute top-0 flex flex-col items-center -translate-x-1/2" style={{ left: `${prPos}%` }}>
              <div className="h-2 w-0.5 bg-amber-500 mb-0.5"></div>
              <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-1 rounded border border-amber-200 shadow-2xs">
                {formatNumber(pr)} <span className="text-[9px] text-amber-600 font-normal">PR</span>
              </span>
            </div>
          )}
          
          {/* Tick Emax */}
          {emax > 0 && (
            <div className="absolute top-0 right-0 flex flex-col items-end">
              <div className="h-2 w-0.5 bg-emerald-600 mb-0.5"></div>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-1 rounded border border-emerald-200 shadow-2xs">
                {formatNumber(emax)} <span className="text-[9px] text-emerald-600 font-normal">Emax</span>
              </span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default KanbanBar;
