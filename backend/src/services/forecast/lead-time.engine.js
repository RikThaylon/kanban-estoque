'use strict';

const { buildForecastConfig } = require('./forecast.config');
const { computeMetrics } = require('./forecast.backtest');
const { mean, median, quantile, robustOutliers, sampleStdDev } = require('./forecast.statistics');

const LEAD_TIME_MODELS = Object.freeze({
  NAIVE: 'NAIVE',
  MEDIAN: 'MEDIAN',
  OLS_TREND: 'OLS_TREND',
  THEIL_SEN: 'THEIL_SEN',
  NOMINAL: 'NOMINAL',
});

const COMPLEXITY = Object.freeze({
  [LEAD_TIME_MODELS.NAIVE]: 0,
  [LEAD_TIME_MODELS.MEDIAN]: 0,
  [LEAD_TIME_MODELS.NOMINAL]: 0,
  [LEAD_TIME_MODELS.OLS_TREND]: 1,
  [LEAD_TIME_MODELS.THEIL_SEN]: 2,
});

function linearRegressionLeadTime(rawLeadTimes) {
  const leadTimes = Array.isArray(rawLeadTimes)
    ? rawLeadTimes.map(Number).filter(Number.isFinite)
    : [];
  if (leadTimes.length < 2) {
    const average = leadTimes.length === 1 ? leadTimes[0] : 0;
    return { previsao: average, sigma: 0, intercepto: average, inclinacao: 0, r2: 0, residuos: [] };
  }
  const n = leadTimes.length;
  const averageX = (n + 1) / 2;
  const averageY = mean(leadTimes);
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < n; index++) {
    const x = index + 1;
    numerator += (x - averageX) * (leadTimes[index] - averageY);
    denominator += (x - averageX) ** 2;
  }
  const inclinacao = denominator > 0 ? numerator / denominator : 0;
  const intercepto = averageY - inclinacao * averageX;
  const residuos = leadTimes.map((value, index) => value - (intercepto + inclinacao * (index + 1)));
  const total = leadTimes.reduce((sum, value) => sum + (value - averageY) ** 2, 0);
  const residual = residuos.reduce((sum, value) => sum + value ** 2, 0);
  const r2 = total > 0 ? Math.max(0, Math.min(1, 1 - residual / total)) : 0;
  const sigma = n > 2 ? Math.sqrt(residual / (n - 2)) : Math.sqrt(residual);
  return {
    previsao: Math.max(0, intercepto + inclinacao * (n + 1)),
    sigma,
    intercepto,
    inclinacao,
    r2,
    residuos,
  };
}

function theilSenLeadTime(leadTimes) {
  if (leadTimes.length < 2) {
    const value = leadTimes[0] || 0;
    return { prediction: value, slope: 0, intercept: value };
  }
  const slopes = [];
  for (let left = 0; left < leadTimes.length - 1; left++) {
    for (let right = left + 1; right < leadTimes.length; right++) {
      slopes.push((leadTimes[right] - leadTimes[left]) / (right - left));
    }
  }
  const slope = median(slopes) || 0;
  const intercept = median(leadTimes.map((value, index) => value - slope * (index + 1))) || 0;
  return { prediction: Math.max(0, intercept + slope * (leadTimes.length + 1)), slope, intercept };
}

function predictLeadTime(model, leadTimes, nominal = null) {
  switch (model) {
    case LEAD_TIME_MODELS.NAIVE:
      return leadTimes.at(-1) || Number(nominal) || 0;
    case LEAD_TIME_MODELS.MEDIAN:
      return median(leadTimes) ?? Number(nominal) ?? 0;
    case LEAD_TIME_MODELS.OLS_TREND:
      return linearRegressionLeadTime(leadTimes).previsao;
    case LEAD_TIME_MODELS.THEIL_SEN:
      return theilSenLeadTime(leadTimes).prediction;
    case LEAD_TIME_MODELS.NOMINAL:
      return Number(nominal) || 0;
    default:
      throw new Error(`Modelo de lead time desconhecido: ${model}`);
  }
}

function evaluateLeadTimeModel(leadTimes, model, config) {
  if (leadTimes.length < 4) return null;
  const actual = [];
  const predicted = [];
  for (let origin = 3; origin < leadTimes.length; origin++) {
    const train = leadTimes.slice(0, origin);
    actual.push(leadTimes[origin]);
    predicted.push(Math.max(0, predictLeadTime(model, train)));
  }
  const metrics = computeMetrics(actual, predicted, [], config.backtest);
  const scale = Math.max(mean(actual), config.epsilon);
  const underBias = Math.max(0, -(metrics.bias || 0)) / scale;
  const score = (metrics.mae || 0) / scale
    + config.backtest.biasPenaltyWeight * config.backtest.underforecastCost * underBias
    + config.backtest.complexityPenaltyWeight * COMPLEXITY[model];
  return {
    model,
    version: `${model.toLowerCase().replaceAll('_', '-')}-v1`,
    complexity: COMPLEXITY[model],
    folds: actual.length,
    metrics,
    residuals: actual.map((value, index) => value - predicted[index]),
    score,
  };
}

function classifyTolerance(actual, forecast, config) {
  const absoluteError = Math.abs(actual - forecast);
  const relativeError = Math.abs(actual) > config.epsilon ? absoluteError / Math.abs(actual) : null;
  let status = 'ACCEPTABLE';
  if (absoluteError > config.tolerance.absolute) {
    if (relativeError !== null && relativeError >= config.tolerance.relativeCritical) status = 'CRITICAL';
    else if (relativeError !== null && relativeError >= config.tolerance.relativeWarning) status = 'WARNING';
  }
  return { actual, forecast, absoluteError, relativeError, status };
}

function analyzeLeadTime(rawLeadTimes, options = {}) {
  const config = buildForecastConfig(options.config);
  const leadTimes = (Array.isArray(rawLeadTimes) ? rawLeadTimes : [])
    .map(Number)
    .filter(value => Number.isFinite(value) && value >= 0);
  const nominal = Number.isFinite(Number(options.nominal)) ? Number(options.nominal) : null;
  const ols = linearRegressionLeadTime(leadTimes);
  const models = [LEAD_TIME_MODELS.NAIVE, LEAD_TIME_MODELS.MEDIAN, LEAD_TIME_MODELS.OLS_TREND, LEAD_TIME_MODELS.THEIL_SEN];
  const evaluations = models
    .map(model => evaluateLeadTimeModel(leadTimes, model, config))
    .filter(Boolean)
    .sort((left, right) => left.score - right.score || left.complexity - right.complexity);
  let champion = evaluations[0] || null;
  if (champion) {
    const acceptableScore = champion.score * (1 + config.backtest.minimumRelativeImprovement);
    champion = evaluations
      .filter(evaluation => evaluation.score <= acceptableScore)
      .sort((left, right) => left.complexity - right.complexity || left.score - right.score)[0];
  }
  const selected = champion?.model || (leadTimes.length ? LEAD_TIME_MODELS.MEDIAN : LEAD_TIME_MODELS.NOMINAL);
  const expected = Math.max(1, predictLeadTime(selected, leadTimes, nominal));
  const residuals = champion?.residuals || [];
  const distributionBase = residuals.length
    ? residuals.map(residual => Math.max(1, expected + residual))
    : (leadTimes.length ? leadTimes : [expected]);
  const stdDev = sampleStdDev(distributionBase);
  const outliers = robustOutliers(leadTimes, config.demand.outlierMadThreshold, config.epsilon);

  return {
    modelSelection: {
      selected,
      version: champion?.version || `${selected.toLowerCase()}-v1`,
      reason: selected === LEAD_TIME_MODELS.OLS_TREND
        ? 'A tendência OLS do lead time foi validada fora da amostra.'
        : selected === LEAD_TIME_MODELS.THEIL_SEN
          ? 'Theil-Sen reduziu o impacto de outliers sem perder a tendência temporal.'
          : selected === LEAD_TIME_MODELS.NOMINAL
            ? 'Sem histórico suficiente; utilizado o lead time nominal do fornecedor.'
            : 'O estimador simples e robusto apresentou menor erro fora da amostra.',
      champion,
      challengers: evaluations.filter(evaluation => evaluation.model !== selected),
    },
    distribution: {
      expected,
      p50: quantile(distributionBase, 0.50),
      p80: quantile(distributionBase, 0.80),
      p90: quantile(distributionBase, 0.90),
      stdDev,
    },
    ols,
    outliers,
    historyLength: leadTimes.length,
    confidence: leadTimes.length < 2 ? 'LOW' : leadTimes.length < 6 ? 'MEDIUM' : 'HIGH',
    tolerance: options.actual === undefined ? null : classifyTolerance(Number(options.actual), expected, config),
  };
}

module.exports = {
  LEAD_TIME_MODELS,
  linearRegressionLeadTime,
  theilSenLeadTime,
  classifyTolerance,
  analyzeLeadTime,
};
