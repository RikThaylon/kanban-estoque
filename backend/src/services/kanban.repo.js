const { query } = require('../config/database');

/**
 * Busca os históricos de consumo e lead time necessários para o cálculo Kanban
 * @param {string} produtoId - ID do produto
 * @returns {Promise<{ demandaSemanalSeries: number[], leadTimeSeries: number[], leadTimeFornecedor: number|null }>}
 */
async function getKanbanSeries(produtoId) {
  // Buscar consumo semanal das últimas 52 semanas
  const consumoRes = await query(`
    SELECT date_trunc('week', criado_em) AS semana,
           COALESCE(SUM(CASE WHEN tipo IN ('SAIDA','TRANSFERENCIA') THEN quantidade ELSE 0 END), 0) AS consumo
    FROM movimentacoes
    WHERE produto_id = $1 AND tipo IN ('SAIDA','TRANSFERENCIA')
      AND criado_em >= NOW() - INTERVAL '52 weeks'
    GROUP BY date_trunc('week', criado_em)
    ORDER BY semana ASC
  `, [produtoId]);

  const demandaSemanalSeries = consumoRes.rows.map(r => parseFloat(r.consumo));

  // Buscar lead times dos últimos 20 pedidos recebidos
  const ltRes = await query(`
    SELECT lead_time_real_dias
    FROM pedidos_compra
    WHERE produto_id = $1 AND status = 'RECEBIDO' AND lead_time_real_dias IS NOT NULL
    ORDER BY data_recebimento DESC
    LIMIT 20
  `, [produtoId]);

  const leadTimeSeries = ltRes.rows.map(r => r.lead_time_real_dias).reverse();

  const fornecedorRes = await query(`
    SELECT lead_time_nominal_dias
    FROM produto_fornecedor
    WHERE produto_id = $1 AND ativo = true AND lead_time_nominal_dias IS NOT NULL
    ORDER BY lead_time_nominal_dias ASC, prioridade ASC
    LIMIT 1
  `, [produtoId]);

  const leadTimeFornecedor = fornecedorRes.rows[0]?.lead_time_nominal_dias
    ? Number(fornecedorRes.rows[0].lead_time_nominal_dias)
    : null;

  return { demandaSemanalSeries, leadTimeSeries, leadTimeFornecedor };
}

module.exports = { getKanbanSeries };
