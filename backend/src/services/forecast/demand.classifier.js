'use strict';

const { buildForecastConfig } = require('./forecast.config');
const {
  mean,
  median,
  sampleStdDev,
  coefficientOfVariation,
  linearRegression,
  autocorrelation,
  mannKendallTau,
  robustOutliers,
  sanitizeNonNegativeSeries,
} = require('./forecast.statistics');

const DEMAND_TYPES = Object.freeze({
  SMOOTH: 'SMOOTH',
  INTERMITTENT: 'INTERMITTENT',
  ERRATIC: 'ERRATIC',
  LUMPY: 'LUMPY',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
});

function classifyDemandType(adi, cv2, config) {
  if (adi === null || cv2 === null) return DEMAND_TYPES.INSUFFICIENT_DATA;
  const sparse = adi >= config.adiThreshold;
  const variable = cv2 >= config.cv2Threshold;
  if (!sparse && !variable) return DEMAND_TYPES.SMOOTH;
  if (sparse && !variable) return DEMAND_TYPES.INTERMITTENT;
  if (!sparse && variable) return DEMAND_TYPES.ERRATIC;
  return DEMAND_TYPES.LUMPY;
}

function detectTrend(series, config, epsilon) {
  const regression = linearRegression(series);
  const avg = mean(series);
  const normalizedSlope = Math.abs(avg) > epsilon ? regression.slope / Math.abs(avg) : 0;
  const tau = mannKendallTau(series);
  const magnitudeRelevant = Math.abs(normalizedSlope) >= config.trendNormalizedSlopeThreshold;
  const evidenceRelevant = regression.r2 >= config.trendR2Threshold || Math.abs(tau) >= config.trendTauThreshold;
  const detected = magnitudeRelevant && evidenceRelevant;
  return {
    detected,
    direction: detected ? (regression.slope > 0 ? 'UP' : 'DOWN') : 'STABLE',
    slope: regression.slope,
    normalizedSlope,
    r2: regression.r2,
    mannKendallTau: tau,
  };
}

function detectSeasonality(series, config) {
  const regression = linearRegression(series);
  const detrended = series.map((value, index) => value - regression.predictions[index]);
  const candidates = config.seasonalPeriods
    .filter(period => Number.isInteger(period) && period > 1 && series.length >= period * config.minimumSeasonalCycles)
    .map(period => ({ period, correlation: autocorrelation(detrended, period) || 0 }))
    .sort((left, right) => right.correlation - left.correlation);
  const strongest = candidates[0] || null;
  const detected = Boolean(strongest && strongest.correlation >= config.seasonalityMinCorrelation);
  return {
    detected,
    period: detected ? strongest.period : null,
    strength: strongest?.correlation || 0,
    candidates,
  };
}

function detectDrift(series, config, epsilon) {
  const window = Math.max(3, Math.floor(config.driftWindow));
  if (series.length < window * 2) {
    return { detected: false, status: 'NOT_ENOUGH_HISTORY', window, meanRatio: 0 };
  }
  const previous = series.slice(-(window * 2), -window);
  const recent = series.slice(-window);
  const previousMean = mean(previous);
  const recentMean = mean(recent);
  const denominator = Math.max(Math.abs(previousMean), epsilon);
  const meanRatio = Math.abs(recentMean - previousMean) / denominator;
  const direction = recentMean > previousMean ? 'UP' : recentMean < previousMean ? 'DOWN' : 'STABLE';
  const detected = meanRatio >= config.driftMeanRatioThreshold;
  return {
    detected,
    status: detected ? 'MODEL_REEVALUATION_REQUIRED' : 'STABLE',
    direction,
    window,
    previousMean,
    recentMean,
    meanRatio,
  };
}

function initialConfidence(historyLength, config) {
  if (historyLength < config.insufficientHistory) return 'INSUFFICIENT_DATA';
  if (historyLength < config.lowConfidenceHistory) return 'LOW';
  if (historyLength < config.normalConfidenceHistory) return 'MEDIUM';
  return 'HIGH';
}

function classifyDemand(rawSeries, options = {}) {
  const config = buildForecastConfig(options.config);
  const { values: series, issues } = sanitizeNonNegativeSeries(rawSeries);
  const nonZero = series.filter(value => value > config.epsilon);
  const avg = mean(series);
  const stdDev = sampleStdDev(series);
  const cv = coefficientOfVariation(series, config.epsilon);
  const nonZeroCv = coefficientOfVariation(nonZero, config.epsilon);
  const adi = nonZero.length > 0 ? series.length / nonZero.length : null;
  const cv2 = nonZeroCv === null ? null : nonZeroCv ** 2;
  const type = series.length < config.demand.insufficientHistory
    ? DEMAND_TYPES.INSUFFICIENT_DATA
    : classifyDemandType(adi, cv2, config.demand);
  const trend = detectTrend(series, config.demand, config.epsilon);
  const outliers = robustOutliers(series, config.demand.outlierMadThreshold, config.epsilon)
    .map(outlier => ({
      ...outlier,
      date: options.dates?.[outlier.index] || null,
      diagnosticTreatment: 'REPLACED_BY_MEDIAN_FOR_SEASONALITY_TEST_ONLY',
    }));
  // A single operational event must not hide a recurring pattern. Values remain
  // untouched for fitting; only the seasonality diagnostic uses a robust center.
  const diagnosticCenter = median(series) || 0;
  const outlierIndexes = new Set(outliers.map(outlier => outlier.index));
  const seasonalityDiagnosticSeries = series.map((value, index) => (
    outlierIndexes.has(index) ? diagnosticCenter : value
  ));
  const seasonality = detectSeasonality(seasonalityDiagnosticSeries, config.demand);
  const drift = detectDrift(series, config.demand, config.epsilon);
  const zeros = series.length - nonZero.length;

  return {
    type,
    historyLength: series.length,
    nonZeroPeriods: nonZero.length,
    zeroPeriods: zeros,
    zeroRatio: series.length > 0 ? zeros / series.length : 0,
    mean: avg,
    stdDev,
    cv,
    adi,
    cv2,
    thresholds: {
      adi: config.demand.adiThreshold,
      cv2: config.demand.cv2Threshold,
      seasonalityCorrelation: config.demand.seasonalityMinCorrelation,
    },
    trend,
    seasonality,
    outliers,
    drift,
    confidence: initialConfidence(series.length, config.demand),
    dataQuality: {
      valid: issues.length === 0,
      issues,
      missingPeriodTreatment: options.missingPeriodTreatment || 'NOT_DECLARED',
      ...options.dataQuality,
    },
    series,
  };
}

module.exports = { DEMAND_TYPES, classifyDemand };
