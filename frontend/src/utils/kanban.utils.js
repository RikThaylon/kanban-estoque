/**
 * Retorna a cor correspondente a uma zona do Kanban
 */
export const getZoneColor = (type) => {
  switch (type) {
    case 'es': return '#CC2030'; // Vermelho operacional
    case 'pr': return '#B86700'; // Amarelo operacional
    case 'verde': return '#0B7A4B'; // Verde operacional
    default: return '#E8EEF7';
  }
};

/**
 * Calcula a largura percentual das zonas na régua Kanban
 */
export const calculateZones = (es, pr, emax) => {
  const max = emax || pr * 1.5 || 100; // fallback se emax for 0
  
  // Garantir limites
  const safeES = Math.min(es, max);
  const safePR = Math.min(pr, max);
  
  const widthES = (safeES / max) * 100;
  const widthPR = ((safePR - safeES) / max) * 100;
  const widthVerde = ((max - safePR) / max) * 100;
  
  return [
    { type: 'es', width: Math.max(0, widthES), label: 'Vermelho' },
    { type: 'pr', width: Math.max(0, widthPR), label: 'Amarelo' },
    { type: 'verde', width: Math.max(0, widthVerde), label: 'Verde' }
  ];
};

/**
 * Retorna o status de urgência baseado nos dias de cobertura
 */
export const getCoberturaStatus = (dias) => {
  if (dias === null || dias === undefined) return { color: 'text-gray-500', label: '-' };
  if (dias <= 3) return { color: 'text-red-600 font-bold', label: `${dias}d` };
  if (dias <= 7) return { color: 'text-amber-600 font-bold', label: `${dias}d` };
  return { color: 'text-green-600 font-medium', label: `${dias}d` };
};
