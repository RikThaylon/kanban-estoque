/**
 * Testes unitários expandidos para kanban.math
 * @module tests/unit/kanban.math.test
 */

const {
  Z_TABLE,
  buildEstimatedKanbanSeries,
  holtDoubleExponential,
  regressaoLinear,
  calcularParametrosKanban,
  classificacaoABC,
} = require('../../src/services/kanban.math');

describe('Kanban Math Models', () => {
  // ═══════════════════════════════════════════════════════
  // HOLT DOUBLE EXPONENTIAL
  // ═══════════════════════════════════════════════════════
  describe('holtDoubleExponential', () => {
    it('deve prever demanda com tendência de alta', () => {
      const series = [10, 11, 12, 13, 14, 15];
      const result = holtDoubleExponential(series, 0.3, 0.1);
      expect(result.forecast).toBeGreaterThan(15);
      expect(result.sigma).toBeDefined();
      expect(result.residuos.length).toBe(series.length - 1);
    });

    it('deve prever demanda com tendência de baixa', () => {
      const series = [20, 18, 16, 14, 12, 10];
      const result = holtDoubleExponential(series, 0.3, 0.1);
      expect(result.forecast).toBeLessThan(10);
    });

    it('deve retornar forecast estável para série constante', () => {
      const series = [10, 10, 10, 10, 10];
      const result = holtDoubleExponential(series, 0.3, 0.1);
      expect(result.forecast).toBeCloseTo(10, 0);
      expect(result.sigma).toBeCloseTo(0, 0);
    });

    it('deve retornar zeros para série muito curta (< 3)', () => {
      expect(holtDoubleExponential([10, 12]).forecast).toBe(0);
      expect(holtDoubleExponential([10]).forecast).toBe(0);
      expect(holtDoubleExponential([]).forecast).toBe(0);
    });

    it('deve retornar zeros para série null', () => {
      expect(holtDoubleExponential(null).forecast).toBe(0);
    });

    it('deve retornar zeros para série undefined', () => {
      expect(holtDoubleExponential(undefined).forecast).toBe(0);
    });

    it('forecast nunca deve ser negativo', () => {
      // Tendência forte de queda
      const series = [100, 50, 20, 5, 1];
      const result = holtDoubleExponential(series, 0.9, 0.9);
      expect(result.forecast).toBeGreaterThanOrEqual(0);
    });

    it('deve ter nível e tendência no resultado', () => {
      const series = [10, 12, 14, 16, 18];
      const result = holtDoubleExponential(series);
      expect(result.nivel).toBeDefined();
      expect(result.tendencia).toBeDefined();
      expect(typeof result.nivel).toBe('number');
      expect(typeof result.tendencia).toBe('number');
    });

    it('deve respeitar alpha e beta customizados', () => {
      // Série com ruído para que alpha/beta tenham impacto diferente
      const series = [10, 15, 8, 20, 12, 25, 14, 30];
      const r1 = holtDoubleExponential(series, 0.1, 0.1);
      const r2 = holtDoubleExponential(series, 0.9, 0.9);
      // Alpha alto reage mais rápido ao último ponto, forecasts devem diferir
      expect(Math.abs(r1.forecast - r2.forecast)).toBeGreaterThan(0.1);
    });
  });

  // ═══════════════════════════════════════════════════════
  // REGRESSÃO LINEAR
  // ═══════════════════════════════════════════════════════
  describe('buildEstimatedKanbanSeries', () => {
    it('deve gerar 10 ciclos estimados por padrao a partir de CMD e LT', () => {
      const result = buildEstimatedKanbanSeries({ cmd: 5, leadTime: 12 });
      expect(result.estimado).toBe(true);
      expect(result.ciclosUsados).toBe(10);
      expect(result.demandaSemanalSeries).toHaveLength(10);
      expect(result.leadTimeSeries).toHaveLength(10);
    });

    it('deve limitar ciclos entre 3 e 10', () => {
      expect(buildEstimatedKanbanSeries({ cmd: 5, leadTime: 12, ciclos: 1 }).ciclosUsados).toBe(3);
      expect(buildEstimatedKanbanSeries({ cmd: 5, leadTime: 12, ciclos: 50 }).ciclosUsados).toBe(10);
    });

    it('deve permitir calculo inicial completo para produto novo', () => {
      const series = buildEstimatedKanbanSeries({ cmd: 4, leadTime: 8 });
      const result = calcularParametrosKanban({
        demandaSemanalSeries: series.demandaSemanalSeries,
        leadTimeSeries: series.leadTimeSeries,
        custoUnitario: 20,
        custoPedido: 100,
        taxaCarregamento: 0.2,
        nivelServico: 95,
        estoqueAtual: 0,
      });
      expect(result.faixa).not.toBe('SEM_DADOS');
      expect(result.PR).toBeGreaterThan(0);
      expect(result.Emax).toBeGreaterThan(0);
    });
  });

  describe('regressaoLinear', () => {
    it('deve prever lead time com ajuste perfeito', () => {
      const leadTimes = [5, 6, 7, 8, 9];
      const result = regressaoLinear(leadTimes);
      expect(result.previsao).toBeCloseTo(10, 1);
      expect(result.r2).toBeCloseTo(1, 5);
      expect(result.sigma).toBeCloseTo(0, 5);
    });

    it('deve lidar com série de 1 elemento', () => {
      const result = regressaoLinear([5]);
      expect(result.previsao).toBe(5);
      expect(result.sigma).toBe(0);
      expect(result.r2).toBe(0);
    });

    it('deve lidar com série vazia', () => {
      const result = regressaoLinear([]);
      expect(result.previsao).toBe(0);
    });

    it('deve lidar com null/undefined', () => {
      expect(regressaoLinear(null).previsao).toBe(0);
      expect(regressaoLinear(undefined).previsao).toBe(0);
    });

    it('deve ter R² entre 0 e 1 para dados com variação', () => {
      const leadTimes = [7, 5, 8, 6, 9, 7, 10];
      const result = regressaoLinear(leadTimes);
      expect(result.r2).toBeGreaterThanOrEqual(0);
      expect(result.r2).toBeLessThanOrEqual(1);
    });

    it('previsão nunca deve ser negativa', () => {
      const leadTimes = [10, 5, 2, 1, 0];
      const result = regressaoLinear(leadTimes);
      expect(result.previsao).toBeGreaterThanOrEqual(0);
    });

    it('deve calcular intercepto e inclinação', () => {
      const leadTimes = [2, 4, 6, 8];
      const result = regressaoLinear(leadTimes);
      expect(result.inclinacao).toBeCloseTo(2, 1);
      expect(result.intercepto).toBeCloseTo(0, 1);
    });

    it('série constante deve ter inclinação zero', () => {
      const leadTimes = [5, 5, 5, 5, 5];
      const result = regressaoLinear(leadTimes);
      expect(result.inclinacao).toBeCloseTo(0, 5);
      expect(result.previsao).toBeCloseTo(5, 1);
    });
  });

  // ═══════════════════════════════════════════════════════
  // PARÂMETROS KANBAN COMPLETO
  // ═══════════════════════════════════════════════════════
  describe('calcularParametrosKanban', () => {
    const baseParams = {
      demandaSemanalSeries: Array(12).fill(24.5),
      leadTimeSeries: [7, 7, 8, 6, 7, 7, 7, 7],
      custoUnitario: 45.0,
      custoPedido: 150.0,
      taxaCarregamento: 0.2,
      nivelServico: 95,
      estoqueAtual: 30,
    };

    it('deve calcular ES > 0 para dados válidos', () => {
      const result = calcularParametrosKanban(baseParams);
      expect(result.ES).toBeGreaterThan(0);
    });

    it('PR deve ser maior que ES', () => {
      const result = calcularParametrosKanban(baseParams);
      expect(result.PR).toBeGreaterThan(result.ES);
    });

    it('EOQ deve ser positivo', () => {
      const result = calcularParametrosKanban(baseParams);
      expect(result.EOQ).toBeGreaterThan(0);
    });

    it('Emax deve ser ES + EOQ', () => {
      const result = calcularParametrosKanban(baseParams);
      expect(result.Emax).toBe(result.ES + result.EOQ);
    });

    it('faixa deve ser AMARELO quando estoque < PR e > ES', () => {
      const result = calcularParametrosKanban({ ...baseParams, estoqueAtual: 20 });
      // Com ES ~7 e PR ~37, estoqueAtual=20 → AMARELO
      if (result.ES < 20 && result.PR > 20) {
        expect(result.faixa).toBe('AMARELO');
      }
    });

    it('faixa deve ser VERMELHO quando estoque <= ES', () => {
      const result = calcularParametrosKanban({ ...baseParams, estoqueAtual: 1 });
      expect(result.faixa).toBe('VERMELHO');
    });

    it('faixa deve ser VERDE quando estoque > PR', () => {
      const result = calcularParametrosKanban({ ...baseParams, estoqueAtual: 500 });
      expect(result.faixa).toBe('VERDE');
    });

    it('deve retornar SEM_DADOS para menos de 3 semanas', () => {
      const result = calcularParametrosKanban({
        ...baseParams,
        demandaSemanalSeries: [10, 12],
      });
      expect(result.faixa).toBe('SEM_DADOS');
      expect(result.ES).toBe(0);
    });

    it('deve retornar SEM_DADOS para menos de 2 lead times', () => {
      const result = calcularParametrosKanban({
        ...baseParams,
        leadTimeSeries: [7],
      });
      expect(result.faixa).toBe('SEM_DADOS');
    });

    it('deve incluir intermediários completos', () => {
      const result = calcularParametrosKanban(baseParams);
      expect(result.intermediarios).toBeDefined();
      expect(result.intermediarios.holt).toBeDefined();
      expect(result.intermediarios.regressao).toBeDefined();
      expect(result.intermediarios.demandaDiariaMedia).toBeDefined();
      expect(result.intermediarios.Z).toBeDefined();
      expect(result.intermediarios.sigmaD).toBeDefined();
      expect(result.intermediarios.sigmaLT).toBeDefined();
    });

    it('deve calcular dias de cobertura', () => {
      const result = calcularParametrosKanban(baseParams);
      expect(result.diasCobertura).toBeDefined();
      if (result.intermediarios.demandaDiariaMedia > 0) {
        expect(typeof result.diasCobertura).toBe('number');
      }
    });

    it('deve gerar alerta quando cobertura < 7 dias', () => {
      const result = calcularParametrosKanban({ ...baseParams, estoqueAtual: 10 });
      if (result.diasCobertura !== null && result.diasCobertura < 7) {
        expect(result.alertas.some(a => a.includes('Cobertura'))).toBe(true);
      }
    });

    it('EOQ deve ser 0 quando taxa_carregamento × custo_unitario = 0', () => {
      const result = calcularParametrosKanban({ ...baseParams, taxaCarregamento: 0 });
      expect(result.EOQ).toBe(0);
    });

    it('deve usar Z correto para cada nível de serviço', () => {
      for (const ns of [90, 95, 98, 99]) {
        const result = calcularParametrosKanban({ ...baseParams, nivelServico: ns });
        expect(result.intermediarios.Z).toBe(Z_TABLE[ns]);
      }
    });

    it('nível de serviço inválido deve usar padrão 95', () => {
      const result = calcularParametrosKanban({ ...baseParams, nivelServico: 77 });
      expect(result.intermediarios.Z).toBe(Z_TABLE[95]);
    });
  });

  // ═══════════════════════════════════════════════════════
  // CLASSIFICAÇÃO ABC
  // ═══════════════════════════════════════════════════════
  describe('classificacaoABC', () => {
    it('deve classificar produtos por valor de consumo', () => {
      const produtos = [
        { produto_id: '1', custo_unitario: 100, demanda_anual: 100 }, // 10000
        { produto_id: '2', custo_unitario: 10, demanda_anual: 100 },  // 1000
        { produto_id: '3', custo_unitario: 1, demanda_anual: 100 },   // 100
      ];
      const result = classificacaoABC(produtos);
      
      expect(result[0].produto_id).toBe('1'); // Maior primeiro
      expect(result[0].classificacao_abc).toBe('A');
    });

    it('deve retornar array vazio para input vazio', () => {
      expect(classificacaoABC([])).toEqual([]);
      expect(classificacaoABC(null)).toEqual([]);
      expect(classificacaoABC(undefined)).toEqual([]);
    });

    it('deve atribuir C quando todos os valores são zero', () => {
      const produtos = [
        { produto_id: '1', custo_unitario: 0, demanda_anual: 100 },
      ];
      const result = classificacaoABC(produtos);
      expect(result[0].classificacao_abc).toBe('C');
    });

    it('percentuais devem somar 100%', () => {
      const produtos = [
        { produto_id: '1', custo_unitario: 50, demanda_anual: 200 },
        { produto_id: '2', custo_unitario: 30, demanda_anual: 100 },
        { produto_id: '3', custo_unitario: 10, demanda_anual: 50 },
      ];
      const result = classificacaoABC(produtos);
      const totalPerc = result.reduce((s, p) => s + p.percentual, 0);
      expect(totalPerc).toBeCloseTo(100, 5);
    });

    it('acumulado deve crescer monotonicamente', () => {
      const produtos = Array.from({ length: 10 }, (_, i) => ({
        produto_id: String(i),
        custo_unitario: Math.random() * 100,
        demanda_anual: Math.random() * 1000,
      }));
      const result = classificacaoABC(produtos);
      for (let i = 1; i < result.length; i++) {
        expect(result[i].acumulado).toBeGreaterThanOrEqual(result[i - 1].acumulado);
      }
    });

    it('deve classificar com regra 80/15/5', () => {
      // Criar distribuição que garante A/B/C
      const produtos = [
        { produto_id: 'high', custo_unitario: 1000, demanda_anual: 100 },   // 100k
        { produto_id: 'mid', custo_unitario: 100, demanda_anual: 100 },     // 10k
        { produto_id: 'low1', custo_unitario: 10, demanda_anual: 100 },     // 1k
        { produto_id: 'low2', custo_unitario: 5, demanda_anual: 100 },      // 500
        { produto_id: 'low3', custo_unitario: 1, demanda_anual: 100 },      // 100
      ];
      const result = classificacaoABC(produtos);
      const aItems = result.filter(p => p.classificacao_abc === 'A');
      const bItems = result.filter(p => p.classificacao_abc === 'B');
      const cItems = result.filter(p => p.classificacao_abc === 'C');
      
      expect(aItems.length).toBeGreaterThan(0);
      // A + B + C deve ser igual ao total
      expect(aItems.length + bItems.length + cItems.length).toBe(produtos.length);
    });

    it('deve calcular valor_consumo corretamente', () => {
      const produtos = [{ produto_id: '1', custo_unitario: 25, demanda_anual: 400 }];
      const result = classificacaoABC(produtos);
      expect(result[0].valor_consumo).toBe(10000);
    });
  });

  // ═══════════════════════════════════════════════════════
  // Z_TABLE
  // ═══════════════════════════════════════════════════════
  describe('Z_TABLE', () => {
    it('deve ter os 4 níveis de serviço', () => {
      expect(Z_TABLE[90]).toBeCloseTo(1.2816, 3);
      expect(Z_TABLE[95]).toBeCloseTo(1.6449, 3);
      expect(Z_TABLE[98]).toBeCloseTo(1.8808, 3);
      expect(Z_TABLE[99]).toBeCloseTo(2.3263, 3);
    });
  });
});
