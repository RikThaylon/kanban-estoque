const { Pool } = require('pg');
const { env } = require('./env');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  logger.error('Erro inesperado no pool PostgreSQL', { error: err.message });
});

pool.on('connect', () => {
  logger.debug('Nova conexão PostgreSQL estabelecida');
});

/**
 * Executa query com parâmetros posicionais
 * @template T
 * @param {string} text - SQL query com $1, $2...
 * @param {Array} [params] - Parâmetros
 * @returns {Promise<{ rows: T[], rowCount: number }>} Result object guaranteeing rows and rowCount
 */
const query = (text, params) => pool.query(text, params);

/**
 * Obtém um client do pool para transações
 * @returns {Promise<import('pg').PoolClient>}
 */
const getClient = () => pool.connect();

module.exports = { pool, query, getClient };
