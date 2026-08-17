'use strict';

const { buildForecastConfig } = require('./forecast.config');
const { mean } = require('./forecast.statistics');
const { DEMAND_TYPES } = require('./demand.classifier');

const MODEL_TYPES = Object.freeze({
  NAIVE: 'NAIVE',
  SEASONAL_NAIVE: 'SEASONAL_NAIVE',
  MOVING_AVERAGE: 'MOVING_AVERAGE',
  SES: 'SES',
  HOLT: 'HOLT',
  HOLT_DAMPED: 'HOLT_DAMPED',
  HOLT_WINTERS_ADD: 'HOLT_WINTERS_ADD',
  CROSTON: 'CROSTON',
  CROSTON_SBA: 'CROSTON_SBA',
  TSB: 'TSB',
});

const MODEL_REGISTRY = Object.freeze({
  [MODEL_TYPES.NAIVE]: { version: 'naive-v1', complexity: 0, minimumHistory: 1 },
  [MODEL_TYPES.SEASONAL_NAIVE]: { version: 'seasonal-naive-v1', complexity: 0, minimumHistory: 2 },
  [MODEL_TYPES.MOVING_AVERAGE]: { version: 'moving-average-v1', complexity: 1, minimumHistory: 2 },
  [MODEL_TYPES.SES]: { version: 'ses-v1', complexity: 1, minimumHistory: 3 },
  [MODEL_TYPES.HOLT]: { version: 'holt-v1', complexity: 2, minimumHistory: 3 },
  [MODEL_TYPES.HOLT_DAMPED]: { version: 'holt-damped-v1', complexity: 3, minimumHistory: 4 },
  [MODEL_TYPES.HOLT_WINTERS_ADD]: { version: 'holt-winters-add-v1', complexity: 4, minimumHistory: 4 },
  [MODEL_TYPES.CROSTON]: { version: 'croston-v1', complexity: 2, minimumHistory: 3 },
  [MODEL_TYPES.CROSTON_SBA]: { version: 'croston-sba-v1', complexity: 2, minimumHistory: 3 },
  [MODEL_TYPES.TSB]: { version: 'tsb-v1', complexity: 3, minimumHistory: 3 },
});

function safeForecast(values) {
  let clippingCount = 0;
  const forecast = values.map(value => {
    if (!Number.isFinite(value) || value < 0) {
      clippingCount++;
      return 0;
    }
    return value;
  });
  return { forecast, clippingCount };
}

function fitNaive(series, horizon) {
  const last = series.at(-1) || 0;
  return { ...safeForecast(Array(horizon).fill(last)), parameters: {} };
}

function fitSeasonalNaive(series, horizon, seasonLength) {
  const period = Math.max(1, Math.min(series.length, Math.floor(seasonLength || 1)));
  const values = Array.from({ length: horizon }, (_, index) => series[series.length - period + (index % period)] || 0);
  return { ...safeForecast(values), parameters: { seasonLength: period } };
}

function fitMovingAverage(series, horizon, window) {
  const usedWindow = Math.max(1, Math.min(series.length, Math.floor(window || 1)));
  const level = mean(series.slice(-usedWindow));
  return { ...safeForecast(Array(horizon).fill(level)), parameters: { window: usedWindow } };
}

function evaluateSesAlpha(series, alpha) {
  let level = series[0] || 0;
  let squaredError = 0;
  for (let index = 1; index < series.length; index++) {
    squaredError += (series[index] - level) ** 2;
    level = alpha * series[index] + (1 - alpha) * level;
  }
  return { level, squaredError };
}

function fitSes(series, horizon, alphas) {
  let best = null;
  for (const alpha of alphas) {
    const candidate = evaluateSesAlpha(series, alpha);
    if (!best || candidate.squaredError < best.squaredError) best = { ...candidate, alpha };
  }
  return {
    ...safeForecast(Array(horizon).fill(best?.level || 0)),
    parameters: { alpha: best?.alpha || alphas[0] || 0.3 },
  };
}

function fitHoltParameters(series, alpha, beta, phi = 1) {
  let level = series[0] || 0;
  let trend = series.length > 1 ? series[1] - series[0] : 0;
  const residuals = [];
  let squaredError = 0;
  for (let index = 1; index < series.length; index++) {
    const prediction = level + phi * trend;
    const residual = series[index] - prediction;
    residuals.push(residual);
    squaredError += residual ** 2;
    const previousLevel = level;
    level = alpha * series[index] + (1 - alpha) * (level + phi * trend);
    trend = beta * (level - previousLevel) + (1 - beta) * phi * trend;
  }
  return { level, trend, residuals, squaredError };
}

function forecastHolt(fit, horizon, phi = 1) {
  const values = [];
  let dampedSum = 0;
  for (let step = 1; step <= horizon; step++) {
    dampedSum += phi ** step;
    values.push(fit.level + dampedSum * fit.trend);
  }
  return safeForecast(values);
}

function fitBestHolt(series, horizon, alphas, betas, phis = [1]) {
  let best = null;
  for (const alpha of alphas) {
    for (const beta of betas) {
      for (const phi of phis) {
        const candidate = fitHoltParameters(series, alpha, beta, phi);
        if (!best || candidate.squaredError < best.squaredError) best = { ...candidate, alpha, beta, phi };
      }
    }
  }
  return {
    ...forecastHolt(best, horizon, best.phi),
    parameters: { alpha: best.alpha, beta: best.beta, phi: best.phi },
    state: { level: best.level, trend: best.trend, residuals: best.residuals },
  };
}

function fitHoltWintersAdditive(series, horizon, seasonLength, config) {
  const period = Math.max(2, Math.floor(seasonLength || 2));
  if (series.length < period * 2) return fitSeasonalNaive(series, horizon, period);
  const alpha = config.holtWintersAlpha;
  const beta = config.holtWintersBeta;
  const gamma = config.holtWintersGamma;
  let level = mean(series.slice(0, period));
  let trend = 0;
  for (let index = 0; index < period; index++) {
    trend += (series[index + period] - series[index]) / period;
  }
  trend /= period;
  const seasonal = series.slice(0, period).map(value => value - level);

  for (let index = 0; index < series.length; index++) {
    const seasonalIndex = index % period;
    const previousLevel = level;
    const currentSeason = seasonal[seasonalIndex];
    level = alpha * (series[index] - currentSeason) + (1 - alpha) * (level + trend);
    trend = beta * (level - previousLevel) + (1 - beta) * trend;
    seasonal[seasonalIndex] = gamma * (series[index] - level) + (1 - gamma) * currentSeason;
  }

  const values = Array.from({ length: horizon }, (_, offset) => {
    const seasonalIndex = (series.length + offset) % period;
    return level + (offset + 1) * trend + seasonal[seasonalIndex];
  });
  return {
    ...safeForecast(values),
    parameters: { alpha, beta, gamma, seasonLength: period, mode: 'ADDITIVE' },
    state: { level, trend, seasonal },
  };
}

function fitCroston(series, horizon, alpha, correction = 1) {
  const firstNonZeroIndex = series.findIndex(value => value > 0);
  if (firstNonZeroIndex < 0) {
    return { ...safeForecast(Array(horizon).fill(0)), parameters: { alpha, correction } };
  }
  let demandSize = series[firstNonZeroIndex];
  let interval = firstNonZeroIndex + 1;
  let elapsed = 1;
  for (let index = firstNonZeroIndex + 1; index < series.length; index++) {
    if (series[index] > 0) {
      demandSize = alpha * series[index] + (1 - alpha) * demandSize;
      interval = alpha * elapsed + (1 - alpha) * interval;
      elapsed = 1;
    } else {
      elapsed++;
    }
  }
  const rate = interval > 0 ? correction * demandSize / interval : 0;
  return {
    ...safeForecast(Array(horizon).fill(rate)),
    parameters: { alpha, correction },
    state: { demandSize, interval, elapsed },
  };
}

function fitTsb(series, horizon, alpha, beta) {
  const firstNonZero = series.find(value => value > 0) || 0;
  let demandSize = firstNonZero;
  let probability = series[0] > 0 ? 1 : 0;
  for (const value of series) {
    const occurrence = value > 0 ? 1 : 0;
    probability = beta * occurrence + (1 - beta) * probability;
    if (occurrence) demandSize = alpha * value + (1 - alpha) * demandSize;
  }
  const rate = probability * demandSize;
  return {
    ...safeForecast(Array(horizon).fill(rate)),
    parameters: { alpha, beta },
    state: { demandSize, probability },
  };
}

function predictModel(modelType, series, horizon = 1, options = {}) {
  const config = buildForecastConfig(options.config);
  const safeHorizon = Math.max(1, Math.floor(Number(horizon) || 1));
  const modelConfig = config.models;
  let result;
  switch (modelType) {
    case MODEL_TYPES.NAIVE:
      result = fitNaive(series, safeHorizon);
      break;
    case MODEL_TYPES.SEASONAL_NAIVE:
      result = fitSeasonalNaive(series, safeHorizon, options.seasonLength);
      break;
    case MODEL_TYPES.MOVING_AVERAGE:
      result = fitMovingAverage(series, safeHorizon, modelConfig.movingAverageWindow);
      break;
    case MODEL_TYPES.SES:
      result = fitSes(series, safeHorizon, modelConfig.sesAlphas);
      break;
    case MODEL_TYPES.HOLT:
      result = fitBestHolt(series, safeHorizon, modelConfig.holtAlphas, modelConfig.holtBetas, [1]);
      break;
    case MODEL_TYPES.HOLT_DAMPED:
      result = fitBestHolt(series, safeHorizon, modelConfig.holtAlphas, modelConfig.holtBetas, modelConfig.dampedPhis);
      break;
    case MODEL_TYPES.HOLT_WINTERS_ADD:
      result = fitHoltWintersAdditive(series, safeHorizon, options.seasonLength, modelConfig);
      break;
    case MODEL_TYPES.CROSTON:
      result = fitCroston(series, safeHorizon, modelConfig.intermittentAlpha, 1);
      break;
    case MODEL_TYPES.CROSTON_SBA:
      result = fitCroston(series, safeHorizon, modelConfig.intermittentAlpha, 1 - modelConfig.intermittentAlpha / 2);
      break;
    case MODEL_TYPES.TSB:
      result = fitTsb(series, safeHorizon, modelConfig.intermittentAlpha, modelConfig.tsbBeta);
      break;
    default:
      throw new Error(`Modelo de forecast desconhecido: ${modelType}`);
  }
  return {
    model: modelType,
    version: MODEL_REGISTRY[modelType].version,
    ...result,
  };
}

function getCandidateModels(profile) {
  const candidates = [MODEL_TYPES.NAIVE, MODEL_TYPES.MOVING_AVERAGE, MODEL_TYPES.SES];
  if (profile.historyLength >= MODEL_REGISTRY[MODEL_TYPES.HOLT].minimumHistory) {
    candidates.push(MODEL_TYPES.HOLT);
  }
  if (profile.trend.detected && profile.historyLength >= MODEL_REGISTRY[MODEL_TYPES.HOLT_DAMPED].minimumHistory) {
    candidates.push(MODEL_TYPES.HOLT_DAMPED);
  }
  if (profile.seasonality.detected) {
    candidates.push(MODEL_TYPES.SEASONAL_NAIVE, MODEL_TYPES.HOLT_WINTERS_ADD);
  }
  if ([DEMAND_TYPES.INTERMITTENT, DEMAND_TYPES.LUMPY].includes(profile.type)) {
    candidates.push(MODEL_TYPES.CROSTON, MODEL_TYPES.CROSTON_SBA, MODEL_TYPES.TSB);
  }
  return [...new Set(candidates)];
}

function holtDoubleExponential(series, alpha = 0.3, beta = 0.1, horizon = 1) {
  if (!Array.isArray(series) || series.length < 3) {
    return { forecast: 0, pointForecast: Array(Math.max(1, horizon)).fill(0), sigma: 0, nivel: 0, tendencia: 0, residuos: [], clippingCount: 0 };
  }
  const fit = fitHoltParameters(series.map(Number), alpha, beta, 1);
  const output = forecastHolt(fit, Math.max(1, horizon), 1);
  const residualMean = mean(fit.residuals);
  const variance = fit.residuals.length > 1
    ? fit.residuals.reduce((sum, value) => sum + (value - residualMean) ** 2, 0) / (fit.residuals.length - 1)
    : 0;
  return {
    forecast: output.forecast[0],
    pointForecast: output.forecast,
    sigma: Math.sqrt(Math.max(0, variance)),
    nivel: fit.level,
    tendencia: fit.trend,
    residuos: fit.residuals,
    clippingCount: output.clippingCount,
  };
}

module.exports = {
  MODEL_TYPES,
  MODEL_REGISTRY,
  predictModel,
  getCandidateModels,
  holtDoubleExponential,
};
