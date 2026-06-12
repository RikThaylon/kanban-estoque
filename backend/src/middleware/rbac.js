const { ForbiddenError } = require('../utils/errors');

// Cargos validos no sistema (mantenha em sincronia com a CHECK do schema usuarios.perfil)
const PERFIS_VALIDOS = [
  'admin',
  'plant_manager',
  'gerente_engenharia',
  'eng_processos',
  'eng_producao',
  'gerente_operacoes',
  'supervisor_turno',
  'comprador',
  'facilitador',
  'visualizador',
];

// Cargos que sao apenas visualizadores (read-only nas operacoes do sistema)
const PERFIS_VISUALIZADORES = ['plant_manager', 'gerente_engenharia', 'eng_processos', 'visualizador'];

// Cargos que aprovam (em ordem hierarquica)
const PERFIS_APROVADORES = {
  nivel1: ['supervisor_turno', 'admin'],
  nivel2: ['gerente_operacoes', 'admin'],
  nivel3: ['plant_manager', 'admin'],
};

// Cargos que executam (criam pedidos, movimentacoes etc.)
const PERFIS_EXECUTORES = ['comprador', 'facilitador'];

/**
 * Mapeamento sintetico de capacidades por perfil — referencia para o frontend.
 * Convencao: '*' = tudo; 'recurso:read' = apenas leitura; 'recurso:*' = leitura e escrita.
 */
const PERMISSIONS = {
  admin: ['*'],
  plant_manager: ['*:read', 'pedidos:aprovar'],
  gerente_engenharia: ['*:read'],
  eng_processos: ['*:read'],
  eng_producao: ['*:read', 'produtos:*'],
  gerente_operacoes: ['*:read', 'pedidos:aprovar', 'pedidos:*', 'usuarios:read', 'movimentacoes:*'],
  supervisor_turno: ['*:read', 'pedidos:aprovar', 'pedidos:*', 'movimentacoes:*'],
  comprador: ['produtos:read', 'movimentacoes:read', 'pedidos:*', 'grafo:read', 'dashboard:read', 'alertas:read', 'relatorios:read'],
  facilitador: ['produtos:read', 'movimentacoes:*', 'pedidos:read', 'grafo:read', 'dashboard:read', 'alertas:read'],
  visualizador: ['dashboard:read', 'produtos:read', 'grafo:read', 'alertas:read', 'raci:read', 'relatorios:read'],
};

/**
 * Middleware de autorizacao por perfil. Aceita lista de perfis permitidos.
 * Admin sempre passa.
 */
const authorize = (...perfisPermitidos) => {
  return (req, res, next) => {
    if (!req.user) return next(new ForbiddenError('Usuário não autenticado'));
    if (req.user.perfil === 'admin') return next();
    if (perfisPermitidos.includes(req.user.perfil)) return next();
    return next(new ForbiddenError('Sem permissão para esta ação'));
  };
};

/** Retorna true se o usuario eh apenas visualizador. */
const isVisualizador = (perfil) => PERFIS_VISUALIZADORES.includes(perfil);

/** Retorna true se o usuario pode aprovar nivel 1 (sup turno). */
const podeAprovarNivel1 = (perfil) => PERFIS_APROVADORES.nivel1.includes(perfil);

/** Retorna true se o usuario pode aprovar nivel 2 (gerente). */
const podeAprovarNivel2 = (perfil) => PERFIS_APROVADORES.nivel2.includes(perfil);

/** Retorna true se o usuario pode aprovar nivel 3 (plant manager). */
const podeAprovarNivel3 = (perfil) => PERFIS_APROVADORES.nivel3.includes(perfil);

module.exports = {
  authorize,
  PERMISSIONS,
  PERFIS_VALIDOS,
  PERFIS_VISUALIZADORES,
  PERFIS_APROVADORES,
  PERFIS_EXECUTORES,
  isVisualizador,
  podeAprovarNivel1,
  podeAprovarNivel2,
  podeAprovarNivel3,
};
