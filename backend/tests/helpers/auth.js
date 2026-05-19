/**
 * Helpers de autenticação para testes.
 * Gera tokens JWT válidos para simular usuários autenticados.
 */
const jwt = require('jsonwebtoken');

const TEST_SECRET = 'test_jwt_secret_that_is_at_least_32_characters_long_for_testing';
const TEST_REFRESH_SECRET = 'test_jwt_refresh_secret_at_least_32_characters_long_testing';

const USERS = {
  admin: {
    id: '00000000-0000-4000-a000-000000000001',
    username: 'admin_test',
    nome: 'Admin Teste',
    perfil: 'admin',
    email: 'admin@test.com',
  },
  gerente_operacoes: {
    id: '00000000-0000-4000-a000-000000000002',
    username: 'gerente_test',
    nome: 'Gerente Teste',
    perfil: 'gerente_operacoes',
    email: 'gerente@test.com',
  },
  supervisor_turno: {
    id: '00000000-0000-4000-a000-000000000003',
    username: 'supervisor_test',
    nome: 'Supervisor Teste',
    perfil: 'supervisor_turno',
    email: 'supervisor@test.com',
  },
  comprador: {
    id: '00000000-0000-4000-a000-000000000004',
    username: 'comprador_test',
    nome: 'Comprador Teste',
    perfil: 'comprador',
    email: 'comprador@test.com',
  },
  facilitador: {
    id: '00000000-0000-4000-a000-000000000005',
    username: 'facilitador_test',
    nome: 'Facilitador Teste',
    perfil: 'facilitador',
    email: 'facilitador@test.com',
  },
  plant_manager: {
    id: '00000000-0000-4000-a000-000000000006',
    username: 'plant_test',
    nome: 'Plant Manager Teste',
    perfil: 'plant_manager',
    email: 'plant@test.com',
  },
  eng_processos: {
    id: '00000000-0000-4000-a000-000000000007',
    username: 'eng_test',
    nome: 'Eng Processos Teste',
    perfil: 'eng_processos',
    email: 'eng@test.com',
  },
  visualizador: {
    id: '00000000-0000-4000-a000-000000000008',
    username: 'visualizador_test',
    nome: 'Visualizador Teste',
    perfil: 'visualizador',
    email: 'visualizador@test.com',
  },
};

/**
 * Gera um access token JWT válido para testes
 * @param {string} perfil - Chave do perfil em USERS (ex: 'admin', 'comprador')
 * @param {object} [overrides] - Campos para sobrescrever no payload
 * @returns {string} JWT access token
 */
function generateTestToken(perfil = 'admin', overrides = {}) {
  const user = USERS[perfil] || USERS.admin;
  return jwt.sign(
    { ...user, ...overrides },
    TEST_SECRET,
    { expiresIn: '1h' }
  );
}

/**
 * Gera um refresh token JWT válido para testes
 * @param {string} perfil - Chave do perfil
 * @returns {string} JWT refresh token
 */
function generateTestRefreshToken(perfil = 'admin') {
  const user = USERS[perfil] || USERS.admin;
  return jwt.sign(
    { id: user.id, type: 'refresh' },
    TEST_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Retorna o header Authorization formatado
 * @param {string} perfil
 * @returns {string}
 */
function authHeader(perfil = 'admin') {
  return `Bearer ${generateTestToken(perfil)}`;
}

module.exports = {
  USERS,
  TEST_SECRET,
  TEST_REFRESH_SECRET,
  generateTestToken,
  generateTestRefreshToken,
  authHeader,
};
