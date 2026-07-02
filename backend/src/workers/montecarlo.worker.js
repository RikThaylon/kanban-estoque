/**
 * @module montecarlo.worker
 * @description Worker Piscina para simulação de Monte Carlo de estoque.
 * Roda em thread separado. Recebe parâmetros, executa N simulações,
 * retorna métricas agregadas (fill rate simulado, stockout risk, distribuição ES).
 *
 * Entradas (task):
 *  - demandaDiariaMedia: número (float)
 *  - sigmaD:             desvio padrão da demanda diária
 *  - ltPrevisto:         lead time previsto em dias (float)
 *  - sigmaLT:            desvio padrão do lead time
 *  - estoqueSeguranca:   ES calculado analiticamente
 *  - pontoReposicao:     PR calculado analiticamente
 *  - nSimulations:       número de iterações (default 10000)
 *  - Z:                  fator Z para o nível de serviço
 *
 * Saída:
 *  - fillRateSimulated:  fração de ciclos sem ruptura
 *  - stockoutRisk:       fração de ciclos com ruptura
 *  - esSugerido:         ES percentil 95 empírico das demandas durante LT
 *  - histogram:          distribuição das demandas durante LT (buckets de 10 bins)
 *  - convergiu:          boolean (fill rate simulado ~ fill rate teórico ±2%)
 */

'use strict';

/**
 * Gera amostra de distribuição normal (Box-Muller)
 */
function randNormal(mean, std) {
  if (std <= 0) return mean;
  let u1, u2;
  do { u1 = Math.random(); } while (u1 === 0);
  u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

/**
 * Gera amostra de distribuição Poisson via Knuth
 */
function randPoisson(lambda) {
  if (lambda <= 0) return 0;
  if (lambda > 30) {
    // Approx. Normal para lambda grande
    return Math.max(0, Math.round(randNormal(lambda, Math.sqrt(lambda))));
  }
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

module.exports = async function montecarlo(task) {
  const {
    demandaDiariaMedia = 0,
    sigmaD = 0,
    ltPrevisto = 1,
    sigmaLT = 0,
    estoqueSeguranca = 0,
    pontoReposicao = 0,
    nSimulations = 10000,
    Z = 1.6449,
    intermitente = false,
  } = task;

  let semRuptura = 0;
  const demandaDuranteLtSamples = [];

  for (let i = 0; i < nSimulations; i++) {
    // Amostrar lead time (sempre Normal clipped)
    const lt = Math.max(1, Math.round(randNormal(ltPrevisto, sigmaLT)));

    // Amostrar demanda durante LT
    let demandaDuranteLT = 0;
    if (intermitente) {
      // Poisson por dia
      for (let d = 0; d < lt; d++) {
        demandaDuranteLT += randPoisson(demandaDiariaMedia);
      }
    } else {
      // Normal acumulada: soma de `lt` variáveis normais independentes
      for (let d = 0; d < lt; d++) {
        demandaDuranteLT += Math.max(0, randNormal(demandaDiariaMedia, sigmaD));
      }
    }

    demandaDuranteLtSamples.push(demandaDuranteLT);

    // Há ruptura se a demanda durante LT supera o PR (o ES vira buffer residual)
    if (demandaDuranteLT <= pontoReposicao) {
      semRuptura++;
    }
  }

  const fillRateSimulated = semRuptura / nSimulations;
  const stockoutRisk = 1 - fillRateSimulated;

  // Percentil 95 da demanda durante LT → ES empírico sugerido
  demandaDuranteLtSamples.sort((a, b) => a - b);
  const p95Index = Math.floor(0.95 * nSimulations);
  const esSugerido = Math.ceil(demandaDuranteLtSamples[p95Index] - (demandaDiariaMedia * ltPrevisto));

  // Histograma (10 bins)
  const min = demandaDuranteLtSamples[0];
  const max = demandaDuranteLtSamples[nSimulations - 1];
  const binSize = (max - min) / 10 || 1;
  const histogram = Array.from({ length: 10 }, (_, i) => ({
    binStart: +(min + i * binSize).toFixed(2),
    binEnd: +(min + (i + 1) * binSize).toFixed(2),
    count: 0,
  }));
  demandaDuranteLtSamples.forEach(v => {
    const bin = Math.min(9, Math.floor((v - min) / binSize));
    histogram[bin].count++;
  });

  // Comparar com fill rate teórico (Normal: P(Z≤z) onde z=ES/sigmaDuranteLT)
  const fillRateTheorical = Z > 0 ? 0.5 + 0.5 * Math.sign(Z) * (1 - Math.exp(-0.7 * Math.abs(Z))) : 0.5;
  const convergiu = Math.abs(fillRateSimulated - fillRateTheorical) < 0.02;

  return {
    fillRateSimulated: +fillRateSimulated.toFixed(4),
    stockoutRisk: +stockoutRisk.toFixed(4),
    esSugerido: Math.max(0, esSugerido),
    histogram,
    convergiu,
    nSimulations,
    fillRateTheorical: +fillRateTheorical.toFixed(4),
  };
};
