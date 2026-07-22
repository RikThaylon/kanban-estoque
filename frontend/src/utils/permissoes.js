export const PAGINAS_SISTEMA = [
  'dashboard',
  'produtos',
  'movimentacoes',
  'pedidos',
  'grafo',
  'fornecedores',
  'configuracoes',
  'maquinas',
  'alertas',
  'raci',
  'relatorios',
  'simulacao',
  'usuarios',
  'seguranca',
];

export const PAGINA_LABELS = {
  dashboard: 'Dashboard',
  produtos: 'Produtos',
  movimentacoes: 'Movimentações',
  pedidos: 'Pedidos de compra',
  grafo: 'Informações',
  fornecedores: 'Fornecedores',
  configuracoes: 'Configurações',
  maquinas: 'Máquinas',
  alertas: 'Alertas',
  raci: 'Matriz RACI',
  relatorios: 'Relatórios',
  simulacao: 'Monte Carlo',
  usuarios: 'Usuários',
};

export const PERFIL_LABELS = {
  admin: 'Administrador',
  plant_manager: 'Plant manager',
  gerente_engenharia: 'Gerente de engenharia',
  eng_processos: 'Eng. de processos',
  eng_producao: 'Eng. de produção',
  gerente_operacoes: 'Gerente de operações',
  supervisor_turno: 'Supervisor de turno',
  comprador: 'Comprador',
  facilitador: 'Facilitador',
  visualizador: 'Visualizador',
};

export const DEFAULTS_PAGINAS = {
  dashboard: ['admin','plant_manager','gerente_engenharia','eng_processos','eng_producao','gerente_operacoes','supervisor_turno','comprador','facilitador','visualizador'],
  produtos: ['admin','plant_manager','gerente_engenharia','eng_processos','eng_producao','gerente_operacoes','supervisor_turno','comprador','facilitador','visualizador'],
  movimentacoes: ['admin','gerente_operacoes','supervisor_turno','comprador','facilitador'],
  pedidos: ['admin','gerente_operacoes','supervisor_turno','comprador','facilitador'],
  grafo: ['admin','plant_manager','gerente_engenharia','eng_processos','eng_producao','gerente_operacoes','supervisor_turno','comprador','facilitador','visualizador'],
  fornecedores: ['admin','comprador'],
  configuracoes: ['admin'],
  maquinas: ['admin','gerente_operacoes','supervisor_turno','eng_producao'],
  alertas: ['admin','plant_manager','gerente_engenharia','eng_processos','eng_producao','gerente_operacoes','supervisor_turno','comprador','facilitador','visualizador'],
  raci: ['admin','plant_manager','gerente_engenharia','eng_processos','eng_producao','gerente_operacoes','supervisor_turno','comprador','facilitador','visualizador'],
  relatorios: ['admin','gerente_operacoes','gerente_engenharia','plant_manager','comprador','visualizador'],
  simulacao: ['admin'],
  usuarios: ['admin','plant_manager','gerente_engenharia','eng_processos','eng_producao','gerente_operacoes'],
  seguranca: ['admin'],
};

export function perfilTemPagina(permissoes, perfil, pagina) {
  if (!perfil) return false;
  if (perfil === 'admin') return true;
  const paginas = permissoes?.paginas || {};
  const perfisDaPagina = paginas[pagina] ?? DEFAULTS_PAGINAS[pagina];
  if (!Array.isArray(perfisDaPagina)) return false;
  return perfisDaPagina.includes(perfil);
}

export function isReadOnlyPerfil(perfil) {
  return perfil === 'visualizador';
}
