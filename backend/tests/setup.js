/**
 * Setup global para todos os testes.
 * Configura variáveis de ambiente ANTES de qualquer import do app.
 */

// Definir env de teste ANTES de qualquer outro módulo ser carregado
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // porta aleatória
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/kanban_test';
process.env.REDIS_ENABLED = 'false';
process.env.JWT_SECRET = 'test_jwt_secret_that_is_at_least_32_characters_long_for_testing';
process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_at_least_32_characters_long_testing';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.BCRYPT_ROUNDS = '4'; // Rápido para testes
process.env.RATE_LIMIT_MAX = '1000'; // Sem limitar em testes

// Silenciar logs durante testes
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});
