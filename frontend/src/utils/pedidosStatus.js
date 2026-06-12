export const STATUS_STYLES = {
  RASCUNHO: 'bg-gray-100 text-gray-700',
  AGUARDANDO_APROVACAO: 'bg-purple-100 text-purple-700',
  AGUARDANDO_GERENTE: 'bg-fuchsia-100 text-fuchsia-700',
  AGUARDANDO_DIRETORIA: 'bg-pink-100 text-pink-700',
  APROVADO: 'bg-blue-100 text-blue-700',
  AGUARDANDO_CHEGADA: 'bg-indigo-100 text-indigo-700',
  EMITIDO: 'bg-indigo-100 text-indigo-700',
  EM_TRANSITO: 'bg-amber-100 text-amber-700',
  RECEBIDO_PARCIAL: 'bg-teal-100 text-teal-700',
  CONCLUIDO: 'bg-green-100 text-green-700',
  RECEBIDO: 'bg-green-100 text-green-700',
  CANCELADO: 'bg-red-100 text-red-700',
  REJEITADO: 'bg-rose-200 text-rose-800',
};

export const STATUS_LABELS = {
  RASCUNHO: 'RASCUNHO',
  AGUARDANDO_APROVACAO: 'AGUARDANDO APROVACAO N1',
  AGUARDANDO_GERENTE: 'AGUARDANDO APROVACAO N2',
  AGUARDANDO_DIRETORIA: 'AGUARDANDO APROVACAO N3',
  APROVADO: 'APROVADO INTERNAMENTE',
  AGUARDANDO_CHEGADA: 'AGUARDANDO CHEGADA',
  EMITIDO: 'AGUARDANDO CHEGADA',
  EM_TRANSITO: 'EM TRANSITO',
  RECEBIDO_PARCIAL: 'RECEBIDO PARCIAL',
  CONCLUIDO: 'CONCLUIDO',
  RECEBIDO: 'CONCLUIDO',
  CANCELADO: 'CANCELADO',
  REJEITADO: 'REJEITADO',
};

export const PEDIDO_STATUS_STEPS = [
  {
    key: 'solicitacao',
    title: 'Solicitacao criada',
    description: 'Pedido registrado no Kanban Estoque.',
    statuses: ['RASCUNHO', 'AGUARDANDO_APROVACAO', 'AGUARDANDO_GERENTE', 'AGUARDANDO_DIRETORIA', 'APROVADO', 'AGUARDANDO_CHEGADA', 'EMITIDO', 'EM_TRANSITO', 'RECEBIDO_PARCIAL', 'CONCLUIDO', 'RECEBIDO'],
  },
  {
    key: 'aprovacao',
    title: 'Aprovacao interna',
    description: 'Supervisor, gerente ou diretoria valida a solicitacao.',
    statuses: ['AGUARDANDO_APROVACAO', 'AGUARDANDO_GERENTE', 'AGUARDANDO_DIRETORIA', 'APROVADO', 'AGUARDANDO_CHEGADA', 'EMITIDO', 'EM_TRANSITO', 'RECEBIDO_PARCIAL', 'CONCLUIDO', 'RECEBIDO'],
    activeStatuses: ['AGUARDANDO_APROVACAO', 'AGUARDANDO_GERENTE', 'AGUARDANDO_DIRETORIA'],
  },
  {
    key: 'compra',
    title: 'OC externa',
    description: 'Comprador registra fornecedor e numero da OC externa.',
    statuses: ['APROVADO', 'AGUARDANDO_CHEGADA', 'EMITIDO', 'EM_TRANSITO', 'RECEBIDO_PARCIAL', 'CONCLUIDO', 'RECEBIDO'],
    activeStatuses: ['APROVADO'],
  },
  {
    key: 'chegada',
    title: 'Chegada do material',
    description: 'Pedido aguarda entrega e lancamento da NF.',
    statuses: ['AGUARDANDO_CHEGADA', 'EMITIDO', 'EM_TRANSITO', 'RECEBIDO_PARCIAL', 'CONCLUIDO', 'RECEBIDO'],
    activeStatuses: ['AGUARDANDO_CHEGADA', 'EMITIDO', 'EM_TRANSITO', 'RECEBIDO_PARCIAL'],
  },
  {
    key: 'conclusao',
    title: 'Concluido',
    description: 'NF registrada e estoque atualizado.',
    statuses: ['CONCLUIDO', 'RECEBIDO'],
    activeStatuses: ['CONCLUIDO', 'RECEBIDO'],
  },
];

export const statusLabel = (status) => STATUS_LABELS[status] || String(status || '').replace(/_/g, ' ');

export const isPedidoFinalizado = (status) => ['CONCLUIDO', 'RECEBIDO', 'CANCELADO', 'REJEITADO'].includes(status);
