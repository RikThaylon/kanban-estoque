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
  'usuarios',
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

export function perfilTemPagina(permissoes, perfil, pagina) {
  if (!perfil) return false;
  if (perfil === 'admin') return true;
  const paginas = permissoes?.paginas || {};
  const perfisDaPagina = paginas[pagina];
  if (!Array.isArray(perfisDaPagina)) return true;
  return perfisDaPagina.includes(perfil);
}

export function isReadOnlyPerfil(perfil) {
  return perfil === 'visualizador';
}
