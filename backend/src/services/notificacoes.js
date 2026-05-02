const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Cria alerta e emite via Socket.io
 */
async function criarAlerta({ produtoId, tipo, titulo, mensagem, severidade }, io = null) {
  const result = await query(
    `INSERT INTO alertas (produto_id, tipo, titulo, mensagem, severidade)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [produtoId, tipo, titulo, mensagem, severidade]
  );
  const alerta = result.rows[0];

  if (io) {
    io.emit('alerta:novo', alerta);
  }

  logger.info('Alerta criado', { tipo, titulo, severidade });
  return alerta;
}

module.exports = { criarAlerta };
