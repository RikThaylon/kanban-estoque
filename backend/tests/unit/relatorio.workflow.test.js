const {
  DIAS_PERIODO_PADRAO,
  DIAS_PERIODO_MAX,
  LIMITE_RANKING_PADRAO,
  LIMITE_RANKING_MAX,
  MESES_PREVISAO_PADRAO,
  MESES_PREVISAO_MAX,
  normalizarPeriodoDias,
  buildPeriodoSQL,
  limitarRanking,
  limitarMesesPrevisao,
  calcularCustoTotalPeriodo,
} = require('../../src/services/relatorio.workflow');

describe('relatorio.workflow', () => {
  it('normaliza periodo de relatorio', () => {
    expect(normalizarPeriodoDias(undefined)).toBe(DIAS_PERIODO_PADRAO);
    expect(normalizarPeriodoDias('0')).toBe(DIAS_PERIODO_PADRAO);
    expect(normalizarPeriodoDias(String(DIAS_PERIODO_MAX + 1))).toBe(DIAS_PERIODO_PADRAO);
    expect(normalizarPeriodoDias('90')).toBe(90);
  });

  it('gera clausula SQL de periodo com alias controlado', () => {
    expect(buildPeriodoSQL('7')).toBe("m.criado_em >= NOW() - INTERVAL '7 days'");
    expect(buildPeriodoSQL('abc', 'pc.criado_em')).toBe("pc.criado_em >= NOW() - INTERVAL '30 days'");
  });

  it('limita rankings operacionais', () => {
    expect(limitarRanking(undefined)).toBe(LIMITE_RANKING_PADRAO);
    expect(limitarRanking('5')).toBe(5);
    expect(limitarRanking('500')).toBe(LIMITE_RANKING_MAX);
  });

  it('limita meses da previsao de gastos', () => {
    expect(limitarMesesPrevisao(undefined)).toBe(MESES_PREVISAO_PADRAO);
    expect(limitarMesesPrevisao('6')).toBe(6);
    expect(limitarMesesPrevisao('60')).toBe(MESES_PREVISAO_MAX);
  });

  it('calcula custo total do periodo ignorando valores invalidos', () => {
    expect(calcularCustoTotalPeriodo([
      { custo_total: '10.5' },
      { custo_total: null },
      { custo_total: 'abc' },
      { custo_total: 4.5 },
    ])).toBe(15);
  });
});
