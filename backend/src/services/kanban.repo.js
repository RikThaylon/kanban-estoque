const { query } = require('../config/database');
const { env } = require('../config/env');

function aggregateDailyIntoWeeks(values) {
  if (!values.length) return [];
  const fullWeeks = Math.floor(values.length / 7);
  if (fullWeeks === 0) return [values.reduce((sum, value) => sum + value, 0)];
  const offset = values.length - fullWeeks * 7;
  return Array.from({ length: fullWeeks }, (_, week) => values
    .slice(offset + week * 7, offset + (week + 1) * 7)
    .reduce((sum, value) => sum + value, 0));
}

function toDateOnly(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value || '').slice(0, 10);
}

/**
 * Busca os históricos de consumo e lead time necessários para o cálculo Kanban
 * @param {string} produtoId - ID do produto
 * @returns {Promise<object>}
 */
async function getKanbanSeries(produtoId) {
  // A ausência de uma SAÍDA executada entre o primeiro evento e ontem significa
  // consumo registrado igual a zero. Períodos anteriores ao primeiro evento não
  // são inventados. O dia corrente é excluído por ainda estar incompleto.
  const consumoRes = await query(`
    WITH local_clock AS (
      SELECT (CURRENT_TIMESTAMP AT TIME ZONE $2)::date AS today
    ), daily AS (
      SELECT (m.criado_em AT TIME ZONE $2)::date AS dia,
             SUM(m.quantidade)::numeric AS consumo,
             COUNT(*)::integer AS movimentos
      FROM movimentacoes m, local_clock clock
      WHERE m.produto_id = $1
        AND m.tipo = 'SAIDA'
        AND m.status = 'EXECUTADO'
        AND m.criado_em >= CURRENT_TIMESTAMP - INTERVAL '366 days'
        AND (m.criado_em AT TIME ZONE $2)::date < clock.today
      GROUP BY (m.criado_em AT TIME ZONE $2)::date
    ), bounds AS (
      SELECT MIN(dia) AS inicio, (SELECT today - 1 FROM local_clock) AS fim
      FROM daily
    ), calendar AS (
      SELECT generate_series(inicio, fim, INTERVAL '1 day')::date AS dia
      FROM bounds
      WHERE inicio IS NOT NULL AND inicio <= fim
    )
    SELECT calendar.dia,
           COALESCE(daily.consumo, 0) AS consumo,
           COALESCE(daily.movimentos, 0) AS movimentos,
           (daily.dia IS NULL) AS zero_preenchido
    FROM calendar
    LEFT JOIN daily USING (dia)
    ORDER BY calendar.dia ASC
  `, [produtoId, env.APP_TIMEZONE]);

  // Compatibilidade com mocks e consumidores antigos que ainda devolvem semana.
  const legacyWeeklyRows = consumoRes.rows.some(row => row.semana && !row.dia);
  const demandaDiariaObservations = consumoRes.rows.map(row => ({
    date: toDateOnly(row.dia || row.semana),
    value: Number(row.consumo) || 0,
    movementCount: Number(row.movimentos) || 0,
    zeroFilled: Boolean(row.zero_preenchido),
  }));
  const demandaDiariaSeries = demandaDiariaObservations.map(observation => observation.value);
  const demandaSemanalSeries = legacyWeeklyRows
    ? consumoRes.rows.map(row => Number(row.consumo) || 0)
    : aggregateDailyIntoWeeks(demandaDiariaSeries);

  // Buscar lead times dos últimos 20 pedidos recebidos
  const ltRes = await query(`
    SELECT lead_time_real_dias, fornecedor_id, data_recebimento
    FROM pedidos_compra
    WHERE produto_id = $1 AND status IN ('CONCLUIDO','RECEBIDO') AND lead_time_real_dias IS NOT NULL
    ORDER BY data_recebimento DESC
    LIMIT 20
  `, [produtoId]);

  const fornecedorRes = await query(`
    SELECT fornecedor_id, lead_time_nominal_dias, prioridade
    FROM produto_fornecedor
    WHERE produto_id = $1 AND ativo = true AND lead_time_nominal_dias IS NOT NULL
    ORDER BY prioridade ASC, lead_time_nominal_dias ASC
    LIMIT 1
  `, [produtoId]);

  const fornecedorPreferencialId = fornecedorRes.rows[0]?.fornecedor_id || null;
  const leadTimeRowsPreferenciais = fornecedorPreferencialId
    ? ltRes.rows.filter(row => String(row.fornecedor_id) === String(fornecedorPreferencialId))
    : [];
  const leadTimeRowsUsadas = leadTimeRowsPreferenciais.length >= 2
    ? leadTimeRowsPreferenciais
    : ltRes.rows;
  const leadTimeObservations = leadTimeRowsUsadas.slice().reverse().map(row => ({
    value: Number(row.lead_time_real_dias),
    supplierId: row.fornecedor_id || null,
    receivedAt: row.data_recebimento || null,
  }));
  const leadTimeSeries = leadTimeObservations.map(observation => observation.value);
  const leadTimeFornecedor = fornecedorRes.rows[0]?.lead_time_nominal_dias
    ? Number(fornecedorRes.rows[0].lead_time_nominal_dias)
    : null;

  return {
    demandaSemanalSeries,
    demandaDiariaSeries,
    demandaDiariaObservations,
    leadTimeSeries,
    leadTimeObservations,
    leadTimeFornecedor,
    dataQuality: {
      timezone: env.APP_TIMEZONE,
      aggregation: 'DAILY',
      sourceEventTypes: ['SAIDA'],
      sourceStatus: 'EXECUTADO',
      missingPeriodTreatment: 'ZERO_REGISTERED_CONSUMPTION_BETWEEN_FIRST_EVENT_AND_LAST_COMPLETE_DAY',
      zeroFilledPeriods: demandaDiariaObservations.filter(observation => observation.zeroFilled).length,
      movementDays: demandaDiariaObservations.filter(observation => observation.movementCount > 0).length,
      supplierScope: leadTimeRowsPreferenciais.length >= 2 ? 'PREFERRED_SUPPLIER' : 'ALL_PRODUCT_SUPPLIERS_FALLBACK',
    },
  };
}

module.exports = { getKanbanSeries, aggregateDailyIntoWeeks };
