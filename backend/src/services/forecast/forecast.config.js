'use strict';

const DEFAULT_FORECAST_CONFIG = Object.freeze({
  epsilon: 1e-9,
  demand: Object.freeze({
    adiThreshold: 1.32,
    cv2Threshold: 0.49,
    trendNormalizedSlopeThreshold: 0.02,
    trendR2Threshold: 0.20,
    trendTauThreshold: 0.30,
    seasonalityMinCorrelation: 0.45,
    seasonalPeriods: Object.freeze([7, 30]),
    minimumSeasonalCycles: 2,
    outlierMadThreshold: 3.5,
    insufficientHistory: 7,
    lowConfidenceHistory: 21,
    normalConfidenceHistory: 60,
    driftWindow: 14,
    driftMeanRatioThreshold: 0.50,
  }),
  backtest: Object.freeze({
    minimumTrainSize: 7,
    maximumFolds: 28,
    underforecastCost: 1.5,
    overforecastCost: 1.0,
    biasPenaltyWeight: 0.25,
    instabilityPenaltyWeight: 0.10,
    complexityPenaltyWeight: 0.005,
    minimumRelativeImprovement: 0.02,
  }),
  models: Object.freeze({
    movingAverageWindow: 7,
    sesAlphas: Object.freeze([0.1, 0.2, 0.3, 0.5, 0.7, 0.9]),
    holtAlphas: Object.freeze([0.2, 0.3, 0.5, 0.7]),
    holtBetas: Object.freeze([0.05, 0.1, 0.2, 0.4]),
    dampedPhis: Object.freeze([0.80, 0.90, 0.95, 0.98]),
    holtWintersAlpha: 0.30,
    holtWintersBeta: 0.10,
    holtWintersGamma: 0.20,
    intermittentAlpha: 0.10,
    tsbBeta: 0.10,
  }),
  intervals: Object.freeze({
    bootstrapSamples: 1000,
    quantiles: Object.freeze([0.10, 0.50, 0.75, 0.80, 0.90, 0.95, 0.98, 0.99]),
  }),
  tolerance: Object.freeze({
    absolute: 1,
    relativeWarning: 0.15,
    relativeCritical: 0.30,
  }),
});

function mergeSection(base, override) {
  return { ...base, ...(override || {}) };
}

function buildForecastConfig(overrides = {}) {
  return {
    ...DEFAULT_FORECAST_CONFIG,
    ...overrides,
    demand: mergeSection(DEFAULT_FORECAST_CONFIG.demand, overrides.demand),
    backtest: mergeSection(DEFAULT_FORECAST_CONFIG.backtest, overrides.backtest),
    models: mergeSection(DEFAULT_FORECAST_CONFIG.models, overrides.models),
    intervals: mergeSection(DEFAULT_FORECAST_CONFIG.intervals, overrides.intervals),
    tolerance: mergeSection(DEFAULT_FORECAST_CONFIG.tolerance, overrides.tolerance),
  };
}

module.exports = { DEFAULT_FORECAST_CONFIG, buildForecastConfig };
