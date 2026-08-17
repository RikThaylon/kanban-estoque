const { analyzeDemand } = require('../../src/services/forecast/forecast.engine');
const { computeMetrics, rollingOriginBacktest } = require('../../src/services/forecast/forecast.backtest');
const { MODEL_TYPES } = require('../../src/services/forecast/forecast.models');

describe('Adaptive forecast engine', () => {
  const datasets = {
    stable: Array(70).fill(10),
    trend: Array.from({ length: 70 }, (_, index) => 5 + index * 0.5),
    seasonal: Array.from({ length: 84 }, (_, index) => [4, 6, 8, 10, 14, 9, 5][index % 7]),
    intermittent: Array.from({ length: 90 }, (_, index) => index % 9 === 0 ? 12 : 0),
    lumpy: Array.from({ length: 90 }, (_, index) => index % 8 === 0 ? (index % 16 ? 30 : 5) : 0),
  };

  test.each(Object.entries(datasets))('%s dataset produces finite non-negative forecasts', (_name, series) => {
    const result = analyzeDemand(series, { horizon: 14, trainedUntil: '2026-08-16' });
    expect(result.forecast.pointForecast).toHaveLength(14);
    expect(result.forecast.pointForecast.every(value => Number.isFinite(value) && value >= 0)).toBe(true);
    expect(result.modelSelection.champion).toBeTruthy();
    expect(result.metrics.mae).not.toBeNull();
  });

  test('keeps trend and intermittent models in the candidate set', () => {
    const trend = analyzeDemand(datasets.trend, { horizon: 7 });
    const intermittent = analyzeDemand(datasets.intermittent, { horizon: 7 });
    expect(trend.modelSelection.candidates).toEqual(expect.arrayContaining([MODEL_TYPES.HOLT, MODEL_TYPES.HOLT_DAMPED]));
    expect(intermittent.modelSelection.candidates).toEqual(expect.arrayContaining([
      MODEL_TYPES.CROSTON,
      MODEL_TYPES.CROSTON_SBA,
      MODEL_TYPES.TSB,
    ]));
  });

  test('rolling-origin validation never trains on its test observation', () => {
    const evaluation = rollingOriginBacktest(datasets.trend, MODEL_TYPES.HOLT);
    expect(evaluation.origins.length).toBeGreaterThan(0);
    evaluation.origins.forEach(origin => expect(origin.trainEndIndex).toBeLessThan(origin.testIndex));
  });

  test('bootstrap intervals are reproducible for the same history', () => {
    const first = analyzeDemand(datasets.seasonal, { horizon: 14 });
    const second = analyzeDemand(datasets.seasonal, { horizon: 14 });
    expect(first.forecast.daily).toEqual(second.forecast.daily);
    expect(first.forecast.p95).toBe(second.forecast.p95);
  });

  test('computes documented error metrics and asymmetric shortage cost', () => {
    const metrics = computeMetrics([10, 20], [8, 25], [2, 5], {
      underforecastCost: 2,
      overforecastCost: 1,
    });
    expect(metrics.mae).toBe(3.5);
    expect(metrics.rmse).toBeCloseTo(Math.sqrt(14.5));
    expect(metrics.wape).toBeCloseTo(7 / 30);
    expect(metrics.bias).toBe(1.5);
    expect(metrics.mase).toBe(1);
    expect(metrics.asymmetricCost).toBe(4.5);
  });
});
