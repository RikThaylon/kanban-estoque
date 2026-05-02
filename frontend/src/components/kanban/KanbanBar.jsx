import React from 'react';
import { calculateZones } from '../../utils/kanban.utils';

const KanbanBar = ({ estoqueAtual, es, pr, emax, className = '' }) => {
  const zones = calculateZones(es, pr, emax);
  const max = emax || pr * 1.5 || 100;
  
  // Calcular posição do marcador (limitado a 100%)
  const markerPosition = Math.min((estoqueAtual / max) * 100, 100);
  
  // Definir cor da faixa atual
  let faixaColor = 'bg-surface-300';
  if (estoqueAtual <= es) faixaColor = 'bg-kanban-vermelho';
  else if (estoqueAtual <= pr) faixaColor = 'bg-kanban-amarelo';
  else if (estoqueAtual > pr) faixaColor = 'bg-kanban-verde';

  return (
    <div className={`w-full ${className}`}>
      {/* Régua visual */}
      <div className="relative h-4 rounded-full overflow-hidden flex shadow-inner bg-surface-100 border border-surface-200">
        <div className="h-full bg-kanban-vermelho" style={{ width: `${zones[0].width}%` }}></div>
        <div className="h-full bg-kanban-amarelo" style={{ width: `${zones[1].width}%` }}></div>
        <div className="h-full bg-kanban-verde" style={{ width: `${zones[2].width}%` }}></div>
      </div>

      {/* Eixo X com labels */}
      <div className="relative h-6 mt-1 text-[10px] font-medium text-navy-500">
        <div className="absolute top-0 flex flex-col items-center -translate-x-1/2" style={{ left: '0%' }}>
          <div className="h-1.5 w-px bg-surface-300"></div>
          <span>0</span>
        </div>
        
        {es > 0 && (
          <div className="absolute top-0 flex flex-col items-center -translate-x-1/2" style={{ left: `${zones[0].width}%` }}>
            <div className="h-1.5 w-px bg-surface-300"></div>
            <span>{es} (ES)</span>
          </div>
        )}
        
        {pr > 0 && (
          <div className="absolute top-0 flex flex-col items-center -translate-x-1/2" style={{ left: `${zones[0].width + zones[1].width}%` }}>
            <div className="h-1.5 w-px bg-surface-300"></div>
            <span>{pr} (PR)</span>
          </div>
        )}
        
        {emax > 0 && (
          <div className="absolute top-0 flex flex-col items-center -translate-x-1/2" style={{ left: '100%' }}>
            <div className="h-1.5 w-px bg-surface-300"></div>
            <span>{emax} (Emax)</span>
          </div>
        )}

        {/* Marcador do Estoque Atual */}
        <div 
          className="absolute top-[-24px] flex flex-col items-center -translate-x-1/2 z-10 transition-all duration-500" 
          style={{ left: `${markerPosition}%` }}
        >
          <div className={`px-1.5 py-0.5 rounded text-white text-[10px] font-bold shadow-sm whitespace-nowrap ${faixaColor}`}>
            Atual: {estoqueAtual}
          </div>
          <div className={`w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-l-transparent border-r-transparent ${faixaColor.replace('bg-', 'border-t-')}`}></div>
        </div>
      </div>
    </div>
  );
};

export default KanbanBar;
