'use strict';

/** Deterministic PRNG so an audited run can be reproduced from its seed. */
function createSeededRandom(seed) {
  let state = Number(seed) >>> 0;
  return function random() {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randNormal(mean, std, random) {
  if (std <= 0) return mean;
  let u1;
  do { u1 = random(); } while (u1 === 0);
  const u2 = random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

function randPoisson(lambda, random) {
  if (lambda <= 0) return 0;
  if (lambda > 30) {
    return Math.max(0, Math.round(randNormal(lambda, Math.sqrt(lambda), random)));
  }
  const limit = Math.exp(-lambda);
  let count = 0;
  let probability = 1;
  do {
    count++;
    probability *= random();
  } while (probability > limit);
  return count - 1;
}

function standardNormalCdf(z) {
  if (z < -6) return 0;
  if (z > 6) return 1;
  const a1 = 0.319381530;
  const a2 = -0.356563782;
  const a3 = 1.781477937;
  const a4 = -1.821255978;
  const a5 = 1.330274429;
  const p = 0.2316419;
  const t = 1 / (1 + p * Math.abs(z));
  const polynomial = t * (a1 + t * (a2 + t * (a3 + t * (a4 + t * a5))));
  const density = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  const cdf = 1 - density * polynomial;
  return z >= 0 ? cdf : 1 - cdf;
}

/**
 * Simulates demand during replenishment lead time.
 *
 * This measures cycle service level (fraction of cycles without stockout), not
 * unit fill rate. Legacy result aliases are retained for API compatibility.
 */
module.exports = async function montecarlo(task) {
  const {
    demandaDiariaMedia = 0,
    sigmaD = 0,
    ltPrevisto = 1,
    sigmaLT = 0,
    pontoReposicao = 0,
    nSimulations: requestedSimulations = 10000,
    Z = 1.6449,
    intermitente = false,
    seed = 20260817,
    serviceLevelProbability,
  } = task;

  const nSimulations = Math.max(1, Math.floor(Number(requestedSimulations) || 10000));
  const random = createSeededRandom(seed);
  let noStockoutCycles = 0;
  const demandDuringLeadTimeSamples = [];

  for (let simulation = 0; simulation < nSimulations; simulation++) {
    const leadTime = Math.max(1, Math.round(randNormal(ltPrevisto, sigmaLT, random)));
    let demandDuringLeadTime = 0;
    for (let day = 0; day < leadTime; day++) {
      demandDuringLeadTime += intermitente
        ? randPoisson(demandaDiariaMedia, random)
        : Math.max(0, randNormal(demandaDiariaMedia, sigmaD, random));
    }
    demandDuringLeadTimeSamples.push(demandDuringLeadTime);
    if (demandDuringLeadTime <= pontoReposicao) noStockoutCycles++;
  }

  const cycleServiceLevelSimulated = noStockoutCycles / nSimulations;
  const stockoutProbability = 1 - cycleServiceLevelSimulated;
  demandDuringLeadTimeSamples.sort((a, b) => a - b);
  const p95Index = Math.min(nSimulations - 1, Math.floor(0.95 * nSimulations));
  const esSugerido = Math.ceil(
    demandDuringLeadTimeSamples[p95Index] - demandaDiariaMedia * ltPrevisto
  );

  const min = demandDuringLeadTimeSamples[0];
  const max = demandDuringLeadTimeSamples[nSimulations - 1];
  const binSize = (max - min) / 10 || 1;
  const histogram = Array.from({ length: 10 }, (_, index) => ({
    binStart: +(min + index * binSize).toFixed(2),
    binEnd: +(min + (index + 1) * binSize).toFixed(2),
    count: 0,
  }));
  demandDuringLeadTimeSamples.forEach(value => {
    const bin = Math.min(9, Math.floor((value - min) / binSize));
    histogram[bin].count++;
  });

  const cycleServiceLevelTheoretical = Number.isFinite(Number(serviceLevelProbability))
    ? Number(serviceLevelProbability)
    : standardNormalCdf(Z);
  const convergiu = Math.abs(cycleServiceLevelSimulated - cycleServiceLevelTheoretical) < 0.02;
  const simulated = +cycleServiceLevelSimulated.toFixed(4);
  const theoretical = +cycleServiceLevelTheoretical.toFixed(4);
  const risk = +stockoutProbability.toFixed(4);

  return {
    cycleServiceLevelSimulated: simulated,
    cycleServiceLevelTheoretical: theoretical,
    stockoutProbability: risk,
    fillRateSimulated: simulated,
    fillRateTheorical: theoretical,
    stockoutRisk: risk,
    esSugerido: Math.max(0, esSugerido),
    histogram,
    convergiu,
    nSimulations,
    seed: Number(seed) >>> 0,
    metricSemantics: 'CYCLE_SERVICE_LEVEL',
  };
};

module.exports._test = { createSeededRandom, randNormal, randPoisson, standardNormalCdf };
