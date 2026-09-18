export const STATUS_STYLES = {
  RASCUNHO: 'bg-gray-100 text-gray-700',
  AGUARDANDO_APROVACAO: 'bg-purple-100 text-purple-700',
  AGUARDANDO_GERENTE: 'bg-fuchsia-100 text-fuchsia-700',
  AGUARDANDO_DIRETORIA: 'bg-pink-100 text-pink-700',
  APROVADO: 'bg-red-100 text-red-800',
  AGUARDANDO_CHEGADA: 'bg-steel-200 text-steel-800',
  EMITIDO: 'bg-steel-200 text-steel-800',
  EM_TRANSITO: 'bg-amber-100 text-amber-700',
  RECEBIDO_PARCIAL: 'bg-teal-100 text-teal-700',
  CONCLUIDO: 'bg-green-100 text-green-700',
  RECEBIDO: 'bg-green-100 text-green-700',
  CANCELADO: 'bg-red-100 text-red-700',
  REJEITADO: 'bg-rose-200 text-rose-800',
};

export const STATUS_LABELS = {
  RASCUNHO: 'RASCUNHO',
  AGUARDANDO_APROVACAO: 'AGUARDANDO APROVAÇÃO N1',
  AGUARDANDO_GERENTE: 'AGUARDANDO APROVAÇÃO N2',
  AGUARDANDO_DIRETORIA: 'AGUARDANDO APROVAÇÃO N3',
  APROVADO: 'APROVADO INTERNAMENTE',
  AGUARDANDO_CHEGADA: 'AGUARDANDO CHEGADA',
  EMITIDO: 'AGUARDANDO CHEGADA',
  EM_TRANSITO: 'EM TRÂNSITO',
  RECEBIDO_PARCIAL: 'RECEBIDO PARCIAL',
  CONCLUIDO: 'CONCLUÍDO',
  RECEBIDO: 'CONCLUÍDO',
  CANCELADO: 'CANCELADO',
  REJEITADO: 'REJEITADO',
};

export const PEDIDO_STATUS_STEPS = [
  {
    key: 'solicitacao',
    title: 'Solicitação criada',
    description: 'Pedido registrado no Kanban Estoque.',
    statuses: ['RASCUNHO', 'AGUARDANDO_APROVACAO', 'AGUARDANDO_GERENTE', 'AGUARDANDO_DIRETORIA', 'APROVADO', 'AGUARDANDO_CHEGADA', 'EMITIDO', 'EM_TRANSITO', 'RECEBIDO_PARCIAL', 'CONCLUIDO', 'RECEBIDO'],
  },
  {
    key: 'aprovacao',
    title: 'Aprovação interna',
    description: 'Supervisor, gerente ou diretoria valida a solicitação.',
    statuses: ['AGUARDANDO_APROVACAO', 'AGUARDANDO_GERENTE', 'AGUARDANDO_DIRETORIA', 'APROVADO', 'AGUARDANDO_CHEGADA', 'EMITIDO', 'EM_TRANSITO', 'RECEBIDO_PARCIAL', 'CONCLUIDO', 'RECEBIDO'],
    activeStatuses: ['AGUARDANDO_APROVACAO', 'AGUARDANDO_GERENTE', 'AGUARDANDO_DIRETORIA'],
  },
  {
    key: 'compra',
    title: 'OC externa',
    description: 'Comprador registra fornecedor e número da OC externa.',
    statuses: ['APROVADO', 'AGUARDANDO_CHEGADA', 'EMITIDO', 'EM_TRANSITO', 'RECEBIDO_PARCIAL', 'CONCLUIDO', 'RECEBIDO'],
    activeStatuses: ['APROVADO'],
  },
  {
    key: 'chegada',
    title: 'Chegada do material',
    description: 'Pedido aguarda entrega e lançamento da NF.',
    statuses: ['AGUARDANDO_CHEGADA', 'EMITIDO', 'EM_TRANSITO', 'RECEBIDO_PARCIAL', 'CONCLUIDO', 'RECEBIDO'],
    activeStatuses: ['AGUARDANDO_CHEGADA', 'EMITIDO', 'EM_TRANSITO', 'RECEBIDO_PARCIAL'],
  },
  {
    key: 'conclusao',
    title: 'Concluído',
    description: 'NF registrada e estoque atualizado.',
    statuses: ['CONCLUIDO', 'RECEBIDO'],
    activeStatuses: ['CONCLUIDO', 'RECEBIDO'],
  },
];

export const statusLabel = (status) => STATUS_LABELS[status] || String(status || '').replace(/_/g, ' ');

export const isPedidoFinalizado = (status) => ['CONCLUIDO', 'RECEBIDO', 'CANCELADO', 'REJEITADO'].includes(status);
