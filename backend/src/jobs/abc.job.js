const { query } = require('../config/database');
const { classificacaoABC } = require('../services/kanban.math');
const logger = require('../utils/logger');

/**
 * Job de reclassificação ABC — semanal aos domingos 02:00
 */
async function recalcularABC() {
  logger.info('🔄 Recalculando classificação ABC...');
  try {
    const result = await query(`
      SELECT p.id AS produto_id, p.custo_unitario,
        COALESCE(kp.demanda_diaria_media * 365, 0) AS demanda_anual
      FROM produtos p
      LEFT JOIN kanban_parametros kp ON kp.produto_id = p.id
      WHERE p.ativo = true
    `);

    const produtos = result.rows.map(r => ({
      produto_id: r.produto_id,
      custo_unitario: parseFloat(r.custo_unitario),
      demanda_anual: parseFloat(r.demanda_anual),
    }));

    const abc = classificacaoABC(produtos);

    for (const item of abc) {
      await query('UPDATE produtos SET classificacao_abc = $1, atualizado_em = NOW() WHERE id = $2',
        [item.classificacao_abc, item.produto_id]);
    }

    logger.info(`✅ Classificação ABC atualizada para ${abc.length} produtos`);
  } catch (err) {
    logger.error('Erro no job de classificação ABC', { error: err.message });
  }
}

module.exports = { recalcularABC };
