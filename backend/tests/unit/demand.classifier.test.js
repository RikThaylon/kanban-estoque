const { DEMAND_TYPES, classifyDemand } = require('../../src/services/forecast/demand.classifier');

describe('Demand classifier', () => {
  test('classifies smooth, intermittent and lumpy histories using ADI/CV2', () => {
    const smooth = classifyDemand(Array(60).fill(10));
    const intermittent = classifyDemand(Array.from({ length: 60 }, (_, index) => index % 6 === 0 ? 10 : 0));
    const lumpy = classifyDemand(Array.from({ length: 60 }, (_, index) => index % 6 === 0 ? (index % 12 ? 30 : 2) : 0));

    expect(smooth.type).toBe(DEMAND_TYPES.SMOOTH);
    expect(intermittent.type).toBe(DEMAND_TYPES.INTERMITTENT);
    expect(lumpy.type).toBe(DEMAND_TYPES.LUMPY);
    expect(intermittent.adi).toBeGreaterThanOrEqual(1.32);
  });

  test('detects trend, weekly seasonality and robust outliers without changing the data', () => {
    const trend = classifyDemand(Array.from({ length: 70 }, (_, index) => 10 + index));
    const seasonalSeries = Array.from({ length: 84 }, (_, index) => [4, 6, 8, 11, 14, 9, 5][index % 7]);
    seasonalSeries[55] = 100;
    const seasonal = classifyDemand(seasonalSeries);

    expect(trend.trend.detected).toBe(true);
    expect(trend.trend.direction).toBe('UP');
    expect(seasonal.seasonality.detected).toBe(true);
    expect(seasonal.seasonality.period).toBe(7);
    expect(seasonal.outliers.some(outlier => outlier.index === 55)).toBe(true);
    expect(seasonal.series[55]).toBe(100);
  });

  test('sanitizes invalid and negative observations and reports data quality', () => {
    const result = classifyDemand([1, -2, 'bad', Number.NaN, 3]);
    expect(result.dataQuality.valid).toBe(false);
    expect(result.series).toEqual([1, 0, 0, 0, 3]);
    expect(result.series.every(Number.isFinite)).toBe(true);
  });
});
