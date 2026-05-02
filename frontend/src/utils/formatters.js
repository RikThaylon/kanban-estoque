export const formatMoney = (value) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatNumber = (value, decimals = 0) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

export const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('pt-BR').format(date);
};

export const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const getFaixaColor = (faixa) => {
  switch (faixa) {
    case 'VERDE': return 'bg-kanban-verde text-white';
    case 'AMARELO': return 'bg-kanban-amarelo text-white';
    case 'VERMELHO': return 'bg-kanban-vermelho text-white';
    default: return 'bg-gray-400 text-white';
  }
};

export const getFaixaBgColor = (faixa) => {
  switch (faixa) {
    case 'VERDE': return 'bg-kanban-verde-light';
    case 'AMARELO': return 'bg-kanban-amarelo-light';
    case 'VERMELHO': return 'bg-kanban-vermelho-light';
    default: return 'bg-surface-50';
  }
};
