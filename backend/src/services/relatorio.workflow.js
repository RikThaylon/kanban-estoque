const DIAS_PERIODO_PADRAO = 30;
const DIAS_PERIODO_MAX = 3650;
const LIMITE_RANKING_PADRAO = 10;
const LIMITE_RANKING_MAX = 50;
const MESES_PREVISAO_PADRAO = 12;
const MESES_PREVISAO_MAX = 24;

function normalizarPeriodoDias(periodo) {
  const dias = parseInt(periodo, 10);
  if (Number.isFinite(dias) && dias > 0 && dias <= DIAS_PERIODO_MAX) return dias;
  return DIAS_PERIODO_PADRAO;
}

function buildPeriodoSQL(periodo, alias = 'm.criado_em') {
  const dias = normalizarPeriodoDias(periodo);
  return `${alias} >= NOW() - INTERVAL '${dias} days'`;
}

function limitarRanking(limit) {
  return Math.min(parseInt(limit, 10) || LIMITE_RANKING_PADRAO, LIMITE_RANKING_MAX);
}

function limitarMesesPrevisao(meses) {
  return Math.min(parseInt(meses, 10) || MESES_PREVISAO_PADRAO, MESES_PREVISAO_MAX);
}

function calcularCustoTotalPeriodo(pedidos) {
  return pedidos.reduce((total, pedido) => total + (parseFloat(pedido.custo_total) || 0), 0);
}

module.exports = {
  DIAS_PERIODO_PADRAO,
  DIAS_PERIODO_MAX,
  LIMITE_RANKING_PADRAO,
  LIMITE_RANKING_MAX,
  MESES_PREVISAO_PADRAO,
  MESES_PREVISAO_MAX,
  normalizarPeriodoDias,
  buildPeriodoSQL,
  limitarRanking,
  limitarMesesPrevisao,
  calcularCustoTotalPeriodo,
};
