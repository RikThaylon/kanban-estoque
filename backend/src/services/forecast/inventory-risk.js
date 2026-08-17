'use strict';

const { standardNormalCdf } = require('./forecast.statistics');

const SERVICE_LEVEL_QUANTILE = Object.freeze({
  90: 'p90',
  95: 'p95',
  98: 'p98',
  99: 'p99',
});

function demandDuringLeadTime(pointForecast, leadTimeDays) {
  const leadTime = Math.max(0, Number(leadTimeDays) || 0);
  const fullDays = Math.floor(leadTime);
  const fraction = leadTime - fullDays;
  let expected = 0;
  for (let day = 0; day < fullDays; day++) {
    expected += Number(pointForecast[day] ?? pointForecast.at(-1) ?? 0);
  }
  if (fraction > 0) {
    expected += fraction * Number(pointForecast[fullDays] ?? pointForecast.at(-1) ?? 0);
  }
  return expected;
}

function stockoutRiskLevel(probability) {
  if (probability < 0.05) return 'LOW';
  if (probability < 0.15) return 'MEDIUM';
  return 'HIGH';
}

function calculateInventoryRisk({
  forecastAnalysis,
  leadTimeDays,
  sigmaDemandDaily = 0,
  sigmaLeadTime = 0,
  serviceLevel = 95,
  inventory = 0,
}) {
  const pointForecast = forecastAnalysis?.forecast?.pointForecast || [];
  const normalizedLeadTime = Math.max(0, Number(leadTimeDays) || 0);
  const expectedDemand = demandDuringLeadTime(pointForecast, normalizedLeadTime);
  const expectedDaily = forecastAnalysis?.forecast?.expectedDailyDemand || 0;
  const variance = Math.max(0,
    normalizedLeadTime * (Number(sigmaDemandDaily) || 0) ** 2
    + expectedDaily ** 2 * (Number(sigmaLeadTime) || 0) ** 2);
  const sigmaDuringLeadTime = Math.sqrt(variance);
  const normalSafetyStock = (serviceLevel === 90 ? 1.2816
    : serviceLevel === 98 ? 1.8808
      : serviceLevel === 99 ? 2.3263 : 1.6449) * sigmaDuringLeadTime;
  const quantileKey = SERVICE_LEVEL_QUANTILE[serviceLevel] || 'p95';
  // Aggregate bootstrap quantiles describe the forecast's complete horizon. They
  // are only comparable with demand during lead time when both horizons match.
  const forecastHorizon = Number(forecastAnalysis?.forecast?.horizon);
  const horizonMatchesLeadTime = forecastHorizon === Math.ceil(normalizedLeadTime);
  const empiricalQuantile = horizonMatchesLeadTime
    ? Number(forecastAnalysis?.forecast?.[quantileKey])
    : Number.NaN;
  const intermittent = ['INTERMITTENT', 'LUMPY'].includes(forecastAnalysis?.profile?.type);
  const empiricalSafetyStock = Number.isFinite(empiricalQuantile)
    ? Math.max(0, empiricalQuantile - expectedDemand)
    : null;
  const safetyStock = intermittent && empiricalSafetyStock !== null
    ? empiricalSafetyStock
    : normalSafetyStock;
  let stockoutProbability;
  if (sigmaDuringLeadTime > 0) {
    stockoutProbability = 1 - standardNormalCdf((Number(inventory) - expectedDemand) / sigmaDuringLeadTime);
  } else {
    stockoutProbability = Number(inventory) >= expectedDemand ? 0 : 1;
  }
  stockoutProbability = Math.min(1, Math.max(0, stockoutProbability));
  return {
    expectedDemandDuringLeadTime: expectedDemand,
    sigmaDuringLeadTime,
    safetyStock,
    safetyStockMethod: intermittent && empiricalSafetyStock !== null
      ? 'EMPIRICAL_FORECAST_QUANTILE'
      : 'NORMAL_INDEPENDENT_DEMAND_AND_LEAD_TIME',
    normalSafetyStock,
    empiricalSafetyStock,
    stockoutProbability,
    risk: stockoutRiskLevel(stockoutProbability),
  };
}

module.exports = { demandDuringLeadTime, calculateInventoryRisk, stockoutRiskLevel };
