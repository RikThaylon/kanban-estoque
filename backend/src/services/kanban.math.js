/**
 * @module kanban.math
 * @description Modelos matemáticos para cálculo de parâmetros Kanban.
 * Implementa Suavização Exponencial Dupla de Holt, Regressão Linear,
 * cálculos determinísticos de ES/PR/EOQ e Classificação ABC.
 */
const mathUtils = require('../utils/math');

/** Tabela Z para nível de serviço */
const Z_TABLE = { 90: 1.2816, 95: 1.6449, 98: 1.8808, 99: 2.3263 };
const DEFAULT_ESTIMATED_CYCLES = 10;

function normalizarCiclosEstimativa(ciclos = DEFAULT_ESTIMATED_CYCLES) {
  return Math.min(10, Math.max(3, Math.floor(Number(ciclos) || DEFAULT_ESTIMATED_CYCLES)));
}

function buildEstimatedKanbanSeries({ cmd, leadTime, ciclos = DEFAULT_ESTIMATED_CYCLES }) {
  const demandaDiaria = Number(cmd);
  const leadTimeDias = Number(leadTime);
  if (!Number.isFinite(demandaDiaria) || demandaDiaria <= 0 || !Number.isFinite(leadTimeDias) || leadTimeDias <= 0) {
    return { demandaSemanalSeries: [], leadTimeSeries: [], ciclosUsados: 0, estimado: false };
  }

  const ciclosUsados = normalizarCiclosEstimativa(ciclos);
  const demandaBase = demandaDiaria * 7;
  const demandaFatores = [0.92, 1.04, 0.97, 1.08, 1.0, 0.95, 1.06, 0.99, 1.03, 1.01];
  const leadTimeFatores = [1.0, 1.08, 0.94, 1.04, 0.98, 1.02, 0.96, 1.06, 1.0, 1.03];

  return {
    demandaSemanalSeries: Array.from({ length: ciclosUsados }, (_, i) => Number((demandaBase * demandaFatores[i % demandaFatores.length]).toFixed(4))),
    leadTimeSeries: Array.from({ length: ciclosUsados }, (_, i) => Math.max(1, Number((leadTimeDias * leadTimeFatores[i % leadTimeFatores.length]).toFixed(2)))),
    ciclosUsados,
    estimado: true,
  };
}

/**
 * Suavização Exponencial Dupla de Holt
 * Prevê demanda futura com base em série temporal de consumo semanal.
 *
 * @param {number[]} series - Array de consumo semanal (mínimo 3 observações)
 * @param {number} [alpha=0.3] - Fator de suavização do nível (0-1)
 * @param {number} [beta=0.1] - Fator de suavização da tendência (0-1)
 * @returns {{ forecast: number, sigma: number, nivel: number, tendencia: number, residuos: number[] }}
 */
function holtDoubleExponential(series, alpha = 0.3, beta = 0.1) {
  if (!series || series.length < 3) {
    return { forecast: 0, sigma: 0, nivel: 0, tendencia: 0, residuos: [] };
  }

  // Inicializa nível com primeira observação
  let nivel = series[0];
  // Inicializa tendência com diferença entre as duas primeiras
  let tendencia = series[1] - series[0];
  const residuos = [];

  for (let t = 1; t < series.length; t++) {
    const valor = series[t];
    const previsao = nivel + tendencia;
    residuos.push(valor - previsao);

    // Atualiza nível: L(t) = α × Y(t) + (1-α) × (L(t-1) + T(t-1))
    const nivelAnterior = nivel;
    nivel = alpha * valor + (1 - alpha) * (nivelAnterior + tendencia);

    // Atualiza tendência: T(t) = β × (L(t) - L(t-1)) + (1-β) × T(t-1)
    tendencia = beta * (nivel - nivelAnterior) + (1 - beta) * tendencia;
  }

  // Previsão para próximo período: F(t+1) = L(t) + T(t)
  const forecast = nivel + tendencia;

  // Sigma dos resíduos
  const n = residuos.length;
  const mediaRes = residuos.reduce((s, r) => s + r, 0) / n;
  const variancia = residuos.reduce((s, r) => s + Math.pow(r - mediaRes, 2), 0) / (n - 1 > 0 ? n - 1 : 1);
  const sigma = Math.sqrt(variancia);

  return {
    forecast: Math.max(0, forecast),
    sigma,
    nivel,
    tendencia,
    residuos,
  };
}

/**
 * Regressão Linear Simples para previsão de lead time.
 * Ajusta Y = a + b×X onde X é o índice do pedido.
 *
 * @param {number[]} leadTimes - Array de lead times históricos em dias
 * @returns {{ previsao: number, sigma: number, intercepto: number, inclinacao: number, r2: number }}
 */
function regressaoLinear(leadTimes) {
  if (!leadTimes || leadTimes.length < 2) {
    const media = leadTimes && leadTimes.length === 1 ? leadTimes[0] : 0;
    return { previsao: media, sigma: 0, intercepto: media, inclinacao: 0, r2: 0 };
  }

  const n = leadTimes.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const x = i + 1;
    const y = leadTimes[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  const mediaX = sumX / n;
  const mediaY = sumY / n;

  // b = [n×Σxy − Σx×Σy] ÷ [n×Σx² − (Σx)²]
  const denominador = n * sumX2 - sumX * sumX;
  const inclinacao = denominador !== 0 ? (n * sumXY - sumX * sumY) / denominador : 0;

  // a = ȳ − b × x̄
  const intercepto = mediaY - inclinacao * mediaX;

  // Previsão para próximo pedido (x = n+1)
  const previsao = intercepto + inclinacao * (n + 1);

  // R² para validar qualidade do ajuste
  const ssTot = leadTimes.reduce((s, y) => s + Math.pow(y - mediaY, 2), 0);
  const ssRes = leadTimes.reduce((s, y, i) => {
    const yPred = intercepto + inclinacao * (i + 1);
    return s + Math.pow(y - yPred, 2);
  }, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  // Sigma dos resíduos
  const residuos = leadTimes.map((y, i) => y - (intercepto + inclinacao * (i + 1)));
  const mediaRes = residuos.reduce((s, r) => s + r, 0) / n;
  const variancia = residuos.reduce((s, r) => s + Math.pow(r - mediaRes, 2), 0) / (n - 2 > 0 ? n - 2 : 1);
  const sigma = Math.sqrt(variancia);

  return {
    previsao: Math.max(0, previsao),
    sigma,
    intercepto,
    inclinacao,
    r2,
  };
}

/**
 * Calcula parâmetros Kanban determinísticos.
 * Combina Holt (demanda) + Regressão (lead time) + fórmulas ES/PR/EOQ.
 *
 * @param {object} params
 * @param {number[]} params.demandaSemanalSeries - Consumo semanal histórico
 * @param {number[]} params.leadTimeSeries - Lead times históricos em dias
 * @param {number} params.custoUnitario - R$ por unidade
 * @param {number} params.custoPedido - R$ por emissão de pedido
 * @param {number} params.taxaCarregamento - Decimal (ex: 0.20)
 * @param {number} params.nivelServico - 90, 95, 98 ou 99
 * @param {number} params.estoqueAtual - Unidades atuais
 * @returns {{ ES: number, PR: number, EOQ: number, Emax: number, faixa: string, diasCobertura: number, alertas: string[], intermediarios: object }}
 */
function calcularParametrosKanban({
  demandaSemanalSeries,
  leadTimeSeries,
  leadTimeFornecedor,
  custoUnitario,
  custoPedido,
  taxaCarregamento,
  nivelServico,
  estoqueAtual,
  classificacaoAbc,
  expectedDemand,
  dynamicCv,
}) {
  const alertas = [];

  if ((!leadTimeSeries || leadTimeSeries.length < 2) && !leadTimeFornecedor) {
    return {
      ES: 0, PR: 0, EOQ: 0, Emax: 0,
      faixa: 'SEM_DADOS',
      diasCobertura: null,
      alertas: ['Dados insuficientes: mínimo 2 lead times'],
      insuficiente_historico: true,
      intermediarios: {},
    };
  }

  const Z = Z_TABLE[nivelServico] || Z_TABLE[95];

  // 1. Tiers de Maturidade de Dados para Demanda (Cold-start)
  let demandaDiariaMedia = 0;
  let sigmaD = 0;
  let tierDemanda = 'SEM_DADOS';
  let holt = { forecast: 0, sigma: 0, nivel: 0, tendencia: 0 };
  let cvConfidence = null;

  if (demandaSemanalSeries && demandaSemanalSeries.length >= 12) {
    // Tier 3 - Histórico maduro
    tierDemanda = 'TIER_3_HOLT';
    holt = holtDoubleExponential(demandaSemanalSeries);
    demandaDiariaMedia = holt.forecast / 7;
    sigmaD = holt.sigma / Math.sqrt(7);
  } else if (demandaSemanalSeries && mathUtils.isIntermittent(demandaSemanalSeries)) {
    // Tier 2 - Demanda Intermitente (SBA/Poisson)
    tierDemanda = 'TIER_2_INTERMITENTE';
    holt = holtDoubleExponential(demandaSemanalSeries);
    demandaDiariaMedia = holt.forecast / 7;
    sigmaD = mathUtils.poissonSigma(demandaDiariaMedia);
  } else if (demandaSemanalSeries && demandaSemanalSeries.length >= 3) {
    // Tier 1 - Bayesian Shrinkage (Histórico Curto)
    tierDemanda = 'TIER_1_BAYESIAN';
    holt = holtDoubleExponential(demandaSemanalSeries);
    demandaDiariaMedia = holt.forecast / 7;
    const dataSigma = holt.sigma / Math.sqrt(7);
    
    const fallback = mathUtils.getCvFallback(dynamicCv, null, 1.0);
    const priorSigma = fallback.cv * demandaDiariaMedia;
    cvConfidence = fallback.confidence;
    
    sigmaD = mathUtils.bayesianShrinkage(dataSigma, priorSigma, demandaSemanalSeries.length);
  } else {
    // Tier 0 - Sem Histórico (Proxy)
    tierDemanda = 'TIER_0_PROXY';
    demandaDiariaMedia = expectedDemand || 0;
    const fallback = mathUtils.getCvFallback(dynamicCv, null, 1.0);
    cvConfidence = fallback.confidence;
    sigmaD = fallback.cv * demandaDiariaMedia;
    alertas.push('AVISO: Produto sem histórico. Utilizado proxy de categoria para sigma.');
  }

  // 2. Regressão → lead time previsto e seu desvio
  const usandoLeadTimeFornecedor = (!leadTimeSeries || leadTimeSeries.length < 2) && leadTimeFornecedor;
  const reg = usandoLeadTimeFornecedor
    ? { previsao: Number(leadTimeFornecedor), sigma: 0, intercepto: Number(leadTimeFornecedor), inclinacao: 0, r2: 0 }
    : regressaoLinear(leadTimeSeries);
  const ltPrevisto = Math.max(1, reg.previsao);
  const sigmaLT = reg.sigma;
  // ltSeguro mantido apenas para exposição de buffer no rastreamento
  const ltSeguro = ltPrevisto + Z_TABLE[95] * sigmaLT;

  // 3. ES — fórmula clássica de demanda durante lead time com AMBOS estocásticos:
  //
  //        ES = Z × √( LT × σd² + d² × σLT² )
  //
  //    Termo (LT × σd²)   → variabilidade da demanda durante o lead time previsto
  //    Termo (d² × σLT²)  → impacto da variabilidade do lead time multiplicada
  //                         pela demanda média (atrasos custam d×ΔLT unidades)
  //
  //    Versão anterior usava ES = Z × σd × √LT_seguro, que IGNORAVA o segundo termo
  //    e subestimava o estoque de segurança em 30–50% para itens com d alto e LT instável.
  let ES;
  let sigmaDuranteLT = 0;
  
  if (demandaDiariaMedia === 0 && tierDemanda === 'TIER_0_PROXY') {
    // Fallback: Método de King para demanda zero
    ES = mathUtils.applyKingMethod(classificacaoAbc);
    alertas.push('AVISO: Demanda nula. Utilizado Método de King para Estoque de Segurança.');
  } else {
    const varDuranteLT = ltPrevisto * sigmaD * sigmaD + demandaDiariaMedia * demandaDiariaMedia * sigmaLT * sigmaLT;
    sigmaDuranteLT = Math.sqrt(Math.max(0, varDuranteLT));
    ES = Math.ceil(Z * sigmaDuranteLT);
  }

  // 4. PR = ceil(demanda_diaria × lt_previsto + ES)
  const PR = Math.ceil(demandaDiariaMedia * ltPrevisto + ES);

  // 5. EOQ = ceil(sqrt(2 × D_anual × custo_pedido / H))
  const dAnual = demandaDiariaMedia * 365;
  const H = taxaCarregamento * custoUnitario;
  const EOQ = H > 0 ? Math.ceil(Math.sqrt((2 * dAnual * custoPedido) / H)) : 0;

  // 6. Emáx = ES + EOQ
  const Emax = ES + EOQ;

  // 7. Faixa
  let faixa;
  if (estoqueAtual <= ES) {
    faixa = 'VERMELHO';
    alertas.push('CRÍTICO: Estoque abaixo do Estoque de Segurança');
  } else if (estoqueAtual <= PR) {
    faixa = 'AMARELO';
    alertas.push('ATENÇÃO: Estoque abaixo do Ponto de Reposição');
  } else {
    faixa = 'VERDE';
  }

  // 8. Dias de cobertura
  const diasCobertura = demandaDiariaMedia > 0
    ? Math.round(((estoqueAtual - ES) / demandaDiariaMedia) * 10) / 10
    : null;

  if (diasCobertura !== null && diasCobertura < 7) {
    alertas.push(`AVISO: Cobertura de apenas ${diasCobertura} dias`);
  }

  return {
    ES, PR, EOQ, Emax, faixa, diasCobertura, alertas,
    intermediarios: {
      holt: {
        forecast: holt.forecast,
        sigma: holt.sigma,
        nivel: holt.nivel,
        tendencia: holt.tendencia,
        alpha: 0.3,
        beta: 0.1,
      },
      regressao: {
        previsao: reg.previsao,
        sigma: reg.sigma,
        intercepto: reg.intercepto,
        inclinacao: reg.inclinacao,
        r2: reg.r2,
        fonte: usandoLeadTimeFornecedor ? 'fornecedor' : 'historico',
      },
      demandaDiariaMedia,
      sigmaD,
      ltPrevisto,
      sigmaLT,
      ltSeguro,
      sigmaDuranteLT,
      Z,
      dAnual,
      H,
      nivelServico,
      tierDemanda,
      cvConfidence,
    },
  };
}

/**
 * Classificação ABC por valor de consumo.
 * A = 80% do valor acumulado, B = 15%, C = 5%
 *
 * @param {Array<{produto_id: string, custo_unitario: number, demanda_anual: number}>} produtos
 * @returns {Array<{produto_id: string, valor_consumo: number, percentual: number, acumulado: number, classificacao_abc: string}>}
 */
function classificacaoABC(produtos) {
  if (!produtos || produtos.length === 0) return [];

  // Calcula valor de consumo
  const comValor = produtos.map(p => ({
    ...p,
    valor_consumo: p.custo_unitario * p.demanda_anual,
  }));

  // Ordena por valor decrescente
  comValor.sort((a, b) => b.valor_consumo - a.valor_consumo);

  const total = comValor.reduce((s, p) => s + p.valor_consumo, 0);
  if (total === 0) return comValor.map(p => ({ ...p, percentual: 0, acumulado: 0, classificacao_abc: 'C' }));

  let acumulado = 0;
  return comValor.map(p => {
    const percentual = (p.valor_consumo / total) * 100;
    let classificacao_abc;
    if (acumulado < 80) classificacao_abc = 'A';
    else if (acumulado < 95) classificacao_abc = 'B';
    else classificacao_abc = 'C';
    acumulado += percentual;
    return { ...p, percentual, acumulado, classificacao_abc };
  });
}

module.exports = {
  Z_TABLE,
  DEFAULT_ESTIMATED_CYCLES,
  buildEstimatedKanbanSeries,
  holtDoubleExponential,
  regressaoLinear,
  calcularParametrosKanban,
  classificacaoABC,
};
