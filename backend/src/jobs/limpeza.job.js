const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Job de limpeza de tokens expirados — diário às 03:00
 */
async function limparTokensExpirados() {
  logger.info('🔄 Limpando tokens expirados...');
  try {
    const result = await query('DELETE FROM refresh_tokens WHERE expira_em < NOW() OR revogado = true');
    logger.info(`✅ Tokens removidos: ${result.rowCount}`);
  } catch (err) {
    logger.error('Erro no job de limpeza de tokens', { error: err.message });
  }
}

module.exports = { limparTokensExpirados };
