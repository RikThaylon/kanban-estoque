const { query } = require('../config/database');
const { criarAlerta } = require('../services/notificacoes');
const logger = require('../utils/logger');

/**
 * Job de verificação de pedidos com prazo vencido — diário às 08:00
 */
async function verificarPrazosVencidos(io) {
  logger.info('🔄 Verificando pedidos com prazo vencido...');
  try {
    const result = await query(`
      SELECT pc.id, pc.numero, pc.data_prevista, pc.status, pc.produto_id,
             p.nome AS produto_nome
      FROM pedidos_compra pc
      JOIN produtos p ON p.id = pc.produto_id
      WHERE pc.status IN ('AGUARDANDO_CHEGADA', 'EMITIDO', 'EM_TRANSITO')
        AND pc.data_prevista < CURRENT_DATE
    `);

    for (const pedido of result.rows) {
      await criarAlerta({
        produtoId: pedido.produto_id,
        tipo: 'PEDIDO_ATRASADO',
        titulo: `Pedido ${pedido.numero} com prazo vencido`,
        mensagem: `O pedido para ${pedido.produto_nome} deveria ter sido recebido em ${pedido.data_prevista}. Status atual: ${pedido.status}`,
        severidade: 'CRITICO',
      }, io);
    }

    logger.info(`✅ Verificação de prazos finalizada: ${result.rows.length} pedidos atrasados`);
  } catch (err) {
    logger.error('Erro no job de prazos vencidos', { error: err.message });
  }
}

module.exports = { verificarPrazosVencidos };
