import React from 'react';

const FaixaBadge = ({ faixa, className = '' }) => {
  const getStyles = () => {
    switch (faixa) {
      case 'VERDE':
        return 'bg-kanban-verde-light text-kanban-verde border-kanban-verde/20';
      case 'AMARELO':
        return 'bg-kanban-amarelo-light text-kanban-amarelo border-kanban-amarelo/20';
      case 'VERMELHO':
        return 'bg-kanban-vermelho-light text-kanban-vermelho border-kanban-vermelho/20';
      default:
        return 'bg-surface-100 text-navy-500 border-surface-200';
    }
  };

  const getLabel = () => {
    switch (faixa) {
      case 'VERDE': return 'Verde';
      case 'AMARELO': return 'Amarelo';
      case 'VERMELHO': return 'Vermelho';
      default: return 'Sem Dados';
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStyles()} ${className}`}>
      {getLabel()}
    </span>
  );
};

export default FaixaBadge;
