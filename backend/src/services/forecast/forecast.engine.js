'use strict';

const { buildForecastConfig } = require('./forecast.config');
const { classifyDemand } = require('./demand.classifier');
const { MODEL_REGISTRY, MODEL_TYPES, getCandidateModels, predictModel } = require('./forecast.models');
const { rankModels } = require('./forecast.backtest');
const { mean, quantile, sampleStdDev } = require('./forecast.statistics');

const ENGINE_VERSION = 'auto-selector-v1';

function hashSeed(values) {
  let hash = 2166136261;
  for (const value of values) {
    const scaled = Math.round(value * 10000);
    hash ^= scaled;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function addUtcDays(dateString, days) {
  if (!dateString) return null;
  const date = new Date(`${dateString.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function bootstrapForecast(pointForecast, residuals, config, seed) {
  if (!residuals.length) return null;
  const sampleCount = Math.max(100, Math.floor(config.intervals.bootstrapSamples));
  const random = mulberry32(seed);
  const dailySamples = pointForecast.map(() => []);
  const aggregateSamples = [];
  for (let sample = 0; sample < sampleCount; sample++) {
    let aggregate = 0;
    for (let step = 0; step < pointForecast.length; step++) {
      const residual = residuals[Math.floor(random() * residuals.length)];
      const value = Math.max(0, pointForecast[step] + residual);
      dailySamples[step].push(value);
      aggregate += value;
    }
    aggregateSamples.push(aggregate);
  }

  const toQuantiles = values => Object.fromEntries(config.intervals.quantiles.map(probability => [
    `p${Math.round(probability * 100)}`,
    quantile(values, probability),
  ]));
  return {
    method: 'EMPIRICAL_RESIDUAL_BOOTSTRAP',
    seed,
    samples: sampleCount,
    daily: dailySamples.map(toQuantiles),
    aggregate: toQuantiles(aggregateSamples),
  };
}

function reasonForModel(model, profile) {
  const reasons = {
    [MODEL_TYPES.NAIVE]: 'O baseline do último valor teve o melhor desempenho fora da amostra.',
    [MODEL_TYPES.SEASONAL_NAIVE]: `O padrão sazonal de ${profile.seasonality.period} períodos superou os modelos não sazonais.`,
    [MODEL_TYPES.MOVING_AVERAGE]: 'A média móvel ofereceu o melhor equilíbrio entre erro, estabilidade e simplicidade.',
    [MODEL_TYPES.SES]: 'A série não exige tendência persistente e a suavização simples foi mais estável no backtest.',
    [MODEL_TYPES.HOLT]: 'A tendência contínua foi melhor representada pelo Holt original no backtest.',
    [MODEL_TYPES.HOLT_DAMPED]: 'A tendência foi relevante, mas o amortecimento evitou extrapolação excessiva.',
    [MODEL_TYPES.HOLT_WINTERS_ADD]: `A sazonalidade aditiva de ${profile.seasonality.period} períodos trouxe ganho mensurável no backtest.`,
    [MODEL_TYPES.CROSTON]: 'A demanda intermitente foi melhor descrita separando tamanho e intervalo das ocorrências.',
    [MODEL_TYPES.CROSTON_SBA]: 'A correção SBA reduziu o viés do Croston para esta demanda intermitente.',
    [MODEL_TYPES.TSB]: 'A probabilidade recente de ocorrência foi decisiva para esta demanda intermitente ou em possível obsolescência.',
  };
  return reasons[model] || 'Modelo selecionado pelo menor score validado fora da amostra.';
}

const CONFIDENCE_ORDER = ['INSUFFICIENT_DATA', 'LOW', 'MEDIUM', 'HIGH'];

function lowerConfidence(confidence) {
  const index = CONFIDENCE_ORDER.indexOf(confidence);
  return CONFIDENCE_ORDER[Math.max(0, index - 1)] || 'LOW';
}

function finalConfidence(profile, ranking) {
  let confidence = profile.confidence;
  if (!ranking.champion) return profile.historyLength === 0 ? 'INSUFFICIENT_DATA' : 'LOW';
  const runnerUp = ranking.challengers[0];
  if (runnerUp && ranking.champion.score > 0) {
    const margin = (runnerUp.score - ranking.champion.score) / ranking.champion.score;
    if (margin < 0.05) confidence = lowerConfidence(confidence);
  }
  if (!profile.dataQuality.valid) confidence = lowerConfidence(confidence);
  if (profile.drift.detected) confidence = lowerConfidence(confidence);
  return confidence;
}

function summarizeEvaluation(evaluation) {
  if (!evaluation) return null;
  return {
    model: evaluation.model,
    version: evaluation.version,
    folds: evaluation.folds,
    score: evaluation.score,
    metrics: evaluation.metrics,
  };
}

function analyzeDemand(rawSeries, options = {}) {
  const config = buildForecastConfig(options.config);
  const horizon = Math.min(90, Math.max(1, Math.floor(Number(options.horizon) || 1)));
  const classified = classifyDemand(rawSeries, {
    config,
    dates: options.dates,
    dataQuality: options.dataQuality,
    missingPeriodTreatment: options.missingPeriodTreatment,
  });
  const series = classified.series;
  const profile = { ...classified };
  delete profile.series;
  const candidates = getCandidateModels(profile);
  const seasonLength = profile.seasonality.period || config.demand.seasonalPeriods[0];
  const ranking = rankModels(series, candidates, { config, seasonLength });
  const selectedModel = ranking.champion?.model || MODEL_TYPES.NAIVE;
  const fitted = predictModel(selectedModel, series.length ? series : [0], horizon, { config, seasonLength });
  const residuals = ranking.champion?.residuals || [];
  const bootstrap = bootstrapForecast(fitted.forecast, residuals, config, hashSeed(series));
  const latestDate = options.trainedUntil || options.dates?.at(-1) || null;
  const daily = fitted.forecast.map((expected, index) => ({
    period: index + 1,
    date: addUtcDays(latestDate, index + 1),
    expected,
    lower: bootstrap?.daily[index]?.p10 ?? null,
    p50: bootstrap?.daily[index]?.p50 ?? expected,
    upper: bootstrap?.daily[index]?.p90 ?? null,
    p95: bootstrap?.daily[index]?.p95 ?? null,
  }));
  const expectedDemand = fitted.forecast.reduce((sum, value) => sum + value, 0);
  const confidence = finalConfidence(profile, ranking);

  return {
    engineVersion: ENGINE_VERSION,
    profile,
    modelSelection: {
      selected: selectedModel,
      version: fitted.version,
      parameters: fitted.parameters,
      reason: reasonForModel(selectedModel, profile),
      champion: summarizeEvaluation(ranking.champion),
      challengers: ranking.challengers.map(summarizeEvaluation),
      candidates,
      selectionPolicy: 'ROLLING_ORIGIN_SCORE_WITH_COMPLEXITY_GUARD',
    },
    metrics: ranking.champion?.metrics || {
      mae: null, rmse: null, wape: null, bias: null, mase: null, asymmetricCost: null, instability: null,
    },
    forecast: {
      frequency: options.frequency || 'DAILY',
      horizon,
      daily,
      pointForecast: fitted.forecast,
      expectedDailyDemand: mean(fitted.forecast),
      expectedDemand,
      p50: bootstrap?.aggregate.p50 ?? expectedDemand,
      p75: bootstrap?.aggregate.p75 ?? null,
      p80: bootstrap?.aggregate.p80 ?? null,
      p90: bootstrap?.aggregate.p90 ?? null,
      p95: bootstrap?.aggregate.p95 ?? null,
      p98: bootstrap?.aggregate.p98 ?? null,
      p99: bootstrap?.aggregate.p99 ?? null,
      intervalMethod: bootstrap?.method || 'UNAVAILABLE_INSUFFICIENT_BACKTEST_RESIDUALS',
      bootstrapSamples: bootstrap?.samples || 0,
      residualStdDev: sampleStdDev(residuals),
      clipping: {
        applied: fitted.clippingCount > 0,
        count: fitted.clippingCount,
      },
    },
    confidence,
    drift: profile.drift,
    trainedUntil: latestDate,
    evaluatedAt: new Date().toISOString(),
  };
}

module.exports = { ENGINE_VERSION, analyzeDemand, bootstrapForecast };
