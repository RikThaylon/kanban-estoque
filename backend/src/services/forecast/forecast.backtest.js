'use strict';

const { buildForecastConfig } = require('./forecast.config');
const { MODEL_REGISTRY, MODEL_TYPES, predictModel } = require('./forecast.models');
const { mean, sampleStdDev } = require('./forecast.statistics');

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function computeMetrics(actual, predicted, naiveScales = [], options = {}) {
  if (!actual.length || actual.length !== predicted.length) {
    return { mae: null, rmse: null, wape: null, bias: null, mase: null, asymmetricCost: null, instability: null };
  }
  const absoluteErrors = actual.map((value, index) => Math.abs(predicted[index] - value));
  const errors = actual.map((value, index) => predicted[index] - value);
  const squaredErrors = errors.map(error => error ** 2);
  const mae = mean(absoluteErrors);
  const rmse = Math.sqrt(mean(squaredErrors));
  const denominator = actual.reduce((sum, value) => sum + Math.abs(value), 0);
  const wape = denominator > 0 ? absoluteErrors.reduce((sum, value) => sum + value, 0) / denominator : null;
  const bias = mean(errors);
  const scaledErrors = absoluteErrors.flatMap((error, index) => {
    const scale = naiveScales[index];
    return Number.isFinite(scale) && scale > 0 ? [error / scale] : [];
  });
  const mase = scaledErrors.length ? mean(scaledErrors) : (mae === 0 ? 0 : null);
  const underforecastCost = Number(options.underforecastCost) || 1;
  const overforecastCost = Number(options.overforecastCost) || 1;
  const asymmetricCost = mean(errors.map(error => error < 0
    ? Math.abs(error) * underforecastCost
    : Math.abs(error) * overforecastCost));
  const instability = sampleStdDev(absoluteErrors);
  return {
    mae: finiteOrNull(mae),
    rmse: finiteOrNull(rmse),
    wape: finiteOrNull(wape),
    bias: finiteOrNull(bias),
    mase: finiteOrNull(mase),
    asymmetricCost: finiteOrNull(asymmetricCost),
    instability: finiteOrNull(instability),
  };
}

function naiveScale(train) {
  if (train.length < 2) return null;
  return mean(train.slice(1).map((value, index) => Math.abs(value - train[index])));
}

function rollingOriginBacktest(series, modelType, options = {}) {
  const config = buildForecastConfig(options.config);
  const seasonLength = options.seasonLength || 1;
  let minimumTrainSize = Math.max(config.backtest.minimumTrainSize, MODEL_REGISTRY[modelType].minimumHistory);
  if ([MODEL_TYPES.SEASONAL_NAIVE, MODEL_TYPES.HOLT_WINTERS_ADD].includes(modelType)) {
    minimumTrainSize = Math.max(minimumTrainSize, seasonLength * 2);
  }
  if (series.length <= minimumTrainSize) return null;

  const firstOrigin = Math.max(minimumTrainSize, series.length - config.backtest.maximumFolds);
  const actual = [];
  const predicted = [];
  const residuals = [];
  const scales = [];
  const origins = [];

  for (let origin = firstOrigin; origin < series.length; origin++) {
    const train = series.slice(0, origin);
    const prediction = predictModel(modelType, train, 1, { config, seasonLength }).forecast[0];
    const observed = series[origin];
    actual.push(observed);
    predicted.push(prediction);
    residuals.push(observed - prediction);
    scales.push(naiveScale(train));
    origins.push({ trainEndIndex: origin - 1, testIndex: origin });
  }

  const metrics = computeMetrics(actual, predicted, scales, config.backtest);
  return {
    model: modelType,
    version: MODEL_REGISTRY[modelType].version,
    complexity: MODEL_REGISTRY[modelType].complexity,
    folds: actual.length,
    metrics,
    actual,
    predicted,
    residuals,
    origins,
  };
}

function scoreEvaluation(evaluation, series, config) {
  const metrics = evaluation.metrics;
  const scale = Math.max(mean(series.map(Math.abs)), config.epsilon);
  const error = metrics.wape ?? ((metrics.mae ?? 0) / scale);
  const negativeBias = Math.max(0, -(metrics.bias ?? 0)) / scale;
  const positiveBias = Math.max(0, metrics.bias ?? 0) / scale;
  const biasPenalty = negativeBias * config.backtest.underforecastCost
    + positiveBias * config.backtest.overforecastCost;
  const instabilityPenalty = (metrics.instability ?? 0) / scale;
  return error
    + config.backtest.biasPenaltyWeight * biasPenalty
    + config.backtest.instabilityPenaltyWeight * instabilityPenalty
    + config.backtest.complexityPenaltyWeight * evaluation.complexity;
}

function rankModels(series, candidateModels, options = {}) {
  const config = buildForecastConfig(options.config);
  const evaluations = candidateModels
    .map(model => rollingOriginBacktest(series, model, { ...options, config }))
    .filter(Boolean)
    .map(evaluation => ({ ...evaluation, score: scoreEvaluation(evaluation, series, config) }))
    .sort((left, right) => left.score - right.score || left.complexity - right.complexity);

  if (!evaluations.length) return { champion: null, challengers: [] };
  const numericallyBest = evaluations[0];
  const acceptableScore = numericallyBest.score * (1 + config.backtest.minimumRelativeImprovement);
  const champion = evaluations
    .filter(evaluation => evaluation.score <= acceptableScore)
    .sort((left, right) => left.complexity - right.complexity || left.score - right.score)[0];
  const challengers = evaluations.filter(evaluation => evaluation.model !== champion.model);
  return { champion, challengers, evaluations };
}

module.exports = { computeMetrics, rollingOriginBacktest, rankModels };
