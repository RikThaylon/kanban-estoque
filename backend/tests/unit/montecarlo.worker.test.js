const montecarlo = require('../../src/workers/montecarlo.worker');

describe('Monte Carlo worker', () => {
  test('is reproducible and reports cycle-service semantics', async () => {
    const task = {
      demandaDiariaMedia: 5,
      sigmaD: 1.5,
      ltPrevisto: 7,
      sigmaLT: 1,
      pontoReposicao: 50,
      nSimulations: 2000,
      Z: 1.6449,
      serviceLevelProbability: 0.95,
      seed: 42,
    };
    const first = await montecarlo(task);
    const second = await montecarlo(task);
    expect(first).toEqual(second);
    expect(first.metricSemantics).toBe('CYCLE_SERVICE_LEVEL');
    expect(first.cycleServiceLevelSimulated + first.stockoutProbability).toBeCloseTo(1, 4);
    expect(first.fillRateSimulated).toBe(first.cycleServiceLevelSimulated);
  });
});
