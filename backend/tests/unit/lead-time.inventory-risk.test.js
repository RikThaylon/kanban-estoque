const { analyzeLeadTime, classifyTolerance, linearRegressionLeadTime } = require('../../src/services/forecast/lead-time.engine');
const { calculateInventoryRisk, demandDuringLeadTime } = require('../../src/services/forecast/inventory-risk');

describe('Lead-time forecast and inventory risk', () => {
  test('preserves the verified OLS result and adds a robust distribution', () => {
    const ols = linearRegressionLeadTime([5, 6, 7, 8, 9]);
    const analysis = analyzeLeadTime([5, 6, 7, 8, 9, 10, 40, 11, 12]);
    expect(ols.previsao).toBeCloseTo(10);
    expect(ols.r2).toBeCloseTo(1);
    expect(analysis.distribution.expected).toBeGreaterThan(0);
    expect(analysis.distribution.p90).toBeGreaterThanOrEqual(analysis.distribution.p50);
    expect(analysis.outliers.length).toBeGreaterThan(0);
  });

  test('supports absolute and relative lead-time tolerance', () => {
    expect(classifyTolerance(10, 10.5, {
      epsilon: 1e-9,
      tolerance: { absolute: 1, relativeWarning: 0.1, relativeCritical: 0.3 },
    }).status).toBe('ACCEPTABLE');
    expect(classifyTolerance(10, 14, {
      epsilon: 1e-9,
      tolerance: { absolute: 1, relativeWarning: 0.1, relativeCritical: 0.3 },
    }).status).toBe('CRITICAL');
  });

  test('uses a fractional lead time and never returns invalid risk values', () => {
    expect(demandDuringLeadTime([10, 20, 30], 2.5)).toBe(45);
    const risk = calculateInventoryRisk({
      forecastAnalysis: {
        profile: { type: 'SMOOTH' },
        forecast: { horizon: 3, pointForecast: [10, 20, 30], expectedDailyDemand: 20 },
      },
      leadTimeDays: 2.5,
      sigmaDemandDaily: 3,
      sigmaLeadTime: 1,
      inventory: 40,
      serviceLevel: 95,
    });
    expect(risk.expectedDemandDuringLeadTime).toBe(45);
    expect(risk.safetyStock).toBeGreaterThanOrEqual(0);
    expect(risk.stockoutProbability).toBeGreaterThanOrEqual(0);
    expect(risk.stockoutProbability).toBeLessThanOrEqual(1);
  });

  test('only uses aggregate empirical quantiles when forecast horizon matches lead time', () => {
    const base = {
      profile: { type: 'INTERMITTENT' },
      forecast: { horizon: 30, pointForecast: Array(30).fill(1), expectedDailyDemand: 1, p95: 50 },
    };
    const mismatched = calculateInventoryRisk({ forecastAnalysis: base, leadTimeDays: 5, sigmaDemandDaily: 1 });
    const matched = calculateInventoryRisk({ forecastAnalysis: base, leadTimeDays: 30, sigmaDemandDaily: 1 });
    expect(mismatched.safetyStockMethod).toBe('NORMAL_INDEPENDENT_DEMAND_AND_LEAD_TIME');
    expect(matched.safetyStockMethod).toBe('EMPIRICAL_FORECAST_QUANTILE');
  });
});
