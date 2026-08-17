'use strict';

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function mean(values) {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleVariance(values) {
  if (!values || values.length < 2) return 0;
  const avg = mean(values);
  return values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
}

function sampleStdDev(values) {
  return Math.sqrt(Math.max(0, sampleVariance(values)));
}

function quantile(values, probability) {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const p = Math.min(1, Math.max(0, Number(probability) || 0));
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function median(values) {
  return quantile(values, 0.5);
}

function linearRegression(values) {
  if (!values || values.length < 2) {
    const only = values?.[0] || 0;
    return { intercept: only, slope: 0, r2: 0, predictions: values ? [only] : [] };
  }

  const n = values.length;
  const meanX = (n - 1) / 2;
  const meanY = mean(values);
  let covariance = 0;
  let varianceX = 0;
  for (let index = 0; index < n; index++) {
    covariance += (index - meanX) * (values[index] - meanY);
    varianceX += (index - meanX) ** 2;
  }
  const slope = varianceX > 0 ? covariance / varianceX : 0;
  const intercept = meanY - slope * meanX;
  const predictions = values.map((_, index) => intercept + slope * index);
  const total = values.reduce((sum, value) => sum + (value - meanY) ** 2, 0);
  const residual = values.reduce((sum, value, index) => sum + (value - predictions[index]) ** 2, 0);
  const r2 = total > 0 ? Math.max(0, Math.min(1, 1 - residual / total)) : 0;
  return { intercept, slope, r2, predictions };
}

function autocorrelation(values, lag) {
  if (!values || lag < 1 || values.length <= lag) return null;
  const avg = mean(values);
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < values.length; index++) {
    const centered = values[index] - avg;
    denominator += centered * centered;
    if (index >= lag) numerator += centered * (values[index - lag] - avg);
  }
  if (denominator <= 0) return 0;
  return Math.max(-1, Math.min(1, numerator / denominator));
}

function mannKendallTau(values) {
  if (!values || values.length < 2) return 0;
  let concordant = 0;
  let comparable = 0;
  for (let left = 0; left < values.length - 1; left++) {
    for (let right = left + 1; right < values.length; right++) {
      const difference = values[right] - values[left];
      if (difference === 0) continue;
      comparable++;
      concordant += Math.sign(difference);
    }
  }
  return comparable > 0 ? concordant / comparable : 0;
}

function coefficientOfVariation(values, epsilon = 1e-9) {
  const avg = mean(values);
  if (Math.abs(avg) <= epsilon) return null;
  return sampleStdDev(values) / Math.abs(avg);
}

function robustOutliers(values, threshold = 3.5, epsilon = 1e-9) {
  if (!values || values.length < 3) return [];
  const center = median(values);
  const deviations = values.map(value => Math.abs(value - center));
  const mad = median(deviations);
  if (mad === null || mad <= epsilon) return [];
  return values.flatMap((value, index) => {
    const score = 0.6745 * (value - center) / mad;
    if (Math.abs(score) < threshold) return [];
    return [{
      index,
      value,
      score,
      classification: 'POTENTIAL_EVENT',
      treatment: 'KEPT',
    }];
  });
}

function sanitizeNonNegativeSeries(series) {
  const input = Array.isArray(series) ? series : [];
  const issues = [];
  const values = input.map((rawValue, index) => {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      issues.push({ index, value: rawValue, issue: 'NON_FINITE', treatment: 'ZERO' });
      return 0;
    }
    if (value < 0) {
      issues.push({ index, value, issue: 'NEGATIVE_DEMAND', treatment: 'CLIPPED_TO_ZERO' });
      return 0;
    }
    return value;
  });
  return { values, issues };
}

function standardNormalCdf(z) {
  if (!Number.isFinite(z)) return z > 0 ? 1 : 0;
  if (z <= -8) return 0;
  if (z >= 8) return 1;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const erf = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

module.exports = {
  isFiniteNumber,
  mean,
  sampleVariance,
  sampleStdDev,
  quantile,
  median,
  linearRegression,
  autocorrelation,
  mannKendallTau,
  coefficientOfVariation,
  robustOutliers,
  sanitizeNonNegativeSeries,
  standardNormalCdf,
};
