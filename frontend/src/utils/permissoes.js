export const PAGINAS_SISTEMA = [
  'dashboard',
  'produtos',
  'movimentacoes',
  'pedidos',
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
  movimentacoes: 'Movimentacoes',
  pedidos: 'Pedidos de compra',
  fornecedores: 'Fornecedores',
  configuracoes: 'Configuracoes',
  maquinas: 'Maquinas',
  alertas: 'Alertas',
  raci: 'Matriz RACI',
  relatorios: 'Relatorios',
  usuarios: 'Usuarios',
};

export const PERFIL_LABELS = {
  admin: 'Administrador',
  plant_manager: 'Plant manager',
  gerente_engenharia: 'Gerente engenharia',
  eng_processos: 'Eng. processos',
  eng_producao: 'Eng. producao',
  gerente_operacoes: 'Gerente operacoes',
  supervisor_turno: 'Supervisor turno',
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
