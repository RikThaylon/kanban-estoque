const { query } = require('../config/database');
const { recalcularKanban } = require('../services/kanban.calc');
const logger = require('../utils/logger');

/**
 * Job de recálculo Kanban — executado diariamente às 06:00 e 18:00
 */
async function executarRecalculoKanban(io) {
  logger.info('🔄 Iniciando recálculo Kanban de todos os produtos...');
  try {
    const result = await query('SELECT id, codigo FROM produtos WHERE ativo = true');
    let sucesso = 0, falhas = 0;

    for (const produto of result.rows) {
      try {
        await recalcularKanban(produto.id, io);
        sucesso++;
      } catch (err) {
        falhas++;
        logger.error(`Erro ao recalcular Kanban do produto ${produto.codigo}`, { error: err.message });
      }
    }

    logger.info(`✅ Recálculo Kanban finalizado: ${sucesso} sucesso, ${falhas} falhas`);
  } catch (err) {
    logger.error('Erro fatal no job de recálculo Kanban', { error: err.message });
  }
}

module.exports = { executarRecalculoKanban };
