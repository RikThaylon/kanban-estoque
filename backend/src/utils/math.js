/**
 * @module math
 * @description Funções estatísticas para cálculo de Sigmas com problemas de cold-start (Tiers 0 a 3).
 */

const KING_METHOD_DEFAULTS = {
  A: 10,
  B: 5,
  C: 2
};

/**
 * Método de King para itens totalmente novos sem estimativa de demanda.
 * Estima um Estoque de Segurança puramente baseado em criticidade (Classe ABC).
 */
function applyKingMethod(classificacaoAbc) {
  const kClass = (classificacaoAbc || 'C').toUpperCase();
  return KING_METHOD_DEFAULTS[kClass] || 2;
}

/**
 * Bayesian Shrinkage (Empirical Bayes) para Tier 1.
 * Combina a estimativa da amostra (dataSigma) com a estimativa da categoria (priorSigma).
 */
function bayesianShrinkage(dataSigma, priorSigma, dataCount, priorWeightBase = 5) {
  const wData = dataCount / (dataCount + priorWeightBase);
  const wPrior = 1 - wData;
  return (wData * dataSigma) + (wPrior * priorSigma);
}

/**
 * Verifica se a demanda é intermitente (Tier 2).
 * Por exemplo: se mais de 30% dos períodos tiverem demanda zero.
 */
function isIntermittent(series) {
  if (!series || series.length === 0) return false;
  const zeros = series.filter(val => val === 0).length;
  return (zeros / series.length) >= 0.3;
}

/**
 * Retorna Sigma para distribuição de Poisson, muito útil para Tier 2 (contagem baixa/esparsa).
 * Na distribuição Poisson, a variância é igual à média, logo sigma = sqrt(media).
 */
function poissonSigma(mean) {
  return Math.sqrt(Math.max(0, mean));
}

/**
 * Fallback em cascata para CV (Tier 0).
 */
function getCvFallback(dynamicCv, verticalBenchmarkCv, globalDefaultCv = 1.0) {
  if (dynamicCv !== null && dynamicCv !== undefined && dynamicCv > 0) {
    return { cv: dynamicCv, confidence: 'calculated' };
  }
  if (verticalBenchmarkCv !== null && verticalBenchmarkCv !== undefined && verticalBenchmarkCv > 0) {
    return { cv: verticalBenchmarkCv, confidence: 'seed' };
  }
  return { cv: globalDefaultCv, confidence: 'default' };
}

module.exports = {
  applyKingMethod,
  bayesianShrinkage,
  isIntermittent,
  poissonSigma,
  getCvFallback,
};
