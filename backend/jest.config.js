/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['./tests/setup.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/config/migrate.js',
    '!src/config/seed.js',
    '!src/config/reset.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov'],
  testTimeout: 10000,
  verbose: true,
  // Rodar integration tests em sequência (compartilham estado)
  // Unit tests podem rodar em paralelo
};
