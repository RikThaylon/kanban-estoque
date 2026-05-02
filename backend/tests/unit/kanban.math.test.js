const {
  holtDoubleExponential,
  regressaoLinear,
  calcularParametrosKanban,
  classificacaoABC,
} = require('../../src/services/kanban.math');

describe('Kanban Math Models', () => {
  describe('holtDoubleExponential', () => {
    it('deve prever a próxima demanda com base no histórico', () => {
      // Consumo semanal constante com leve tendência de alta
      const series = [10, 11, 12, 13, 14, 15];
      const result = holtDoubleExponential(series, 0.3, 0.1);
      
      expect(result.forecast).toBeGreaterThan(15);
      expect(result.sigma).toBeDefined();
      expect(result.residuos.length).toBe(series.length - 1);
    });

    it('deve retornar zeros para série muito curta', () => {
      const result = holtDoubleExponential([10, 12]);
      expect(result.forecast).toBe(0);
    });
  });

  describe('regressaoLinear', () => {
    it('deve prever o lead time com base na tendência', () => {
      // Lead times crescentes
      const leadTimes = [5, 6, 7, 8, 9];
      const result = regressaoLinear(leadTimes);
      
      expect(result.previsao).toBeCloseTo(10, 1);
      expect(result.sigma).toBeDefined();
      expect(result.r2).toBe(1); // Ajuste perfeito
    });

    it('deve lidar com série curta', () => {
      const result = regressaoLinear([5]);
      expect(result.previsao).toBe(5);
    });
  });

  describe('calcularParametrosKanban', () => {
    it('deve calcular corretamente para os dados da Válvula VH-200', () => {
      // Dados calibrados para produzir: ES=7, PR=37, EOQ=136, Emax=143
      
      // Demanda Diária = 3.5, logo Consumo Semanal ~ 24.5
      const demandaSemanalSeries = Array(12).fill(24.5);
      
      // Lead time previsto = 7, com alguma variação
      const leadTimeSeries = [7, 7, 8, 6, 7, 7, 7, 7];
      
      const params = {
        demandaSemanalSeries,
        leadTimeSeries,
        custoUnitario: 45.0,
        custoPedido: 150.0,
        taxaCarregamento: 0.2, // H = 9.0
        nivelServico: 95,      // Z = 1.6449
        estoqueAtual: 30,
      };

      const result = calcularParametrosKanban(params);

      expect(result.ES).toBeGreaterThan(0);
      expect(result.PR).toBeGreaterThan(result.ES);
      expect(result.EOQ).toBeGreaterThan(0);
      expect(result.Emax).toBe(result.ES + result.EOQ);
      expect(['VERDE', 'AMARELO', 'VERMELHO']).toContain(result.faixa);
    });
  });

  describe('classificacaoABC', () => {
    it('deve classificar produtos corretamente', () => {
      const produtos = [
        { produto_id: '1', custo_unitario: 100, demanda_anual: 100 }, // Valor: 10000 (Alta)
        { produto_id: '2', custo_unitario: 10, demanda_anual: 100 },  // Valor: 1000 (Média)
        { produto_id: '3', custo_unitario: 1, demanda_anual: 100 },   // Valor: 100 (Baixa)
      ];

      const result = classificacaoABC(produtos);
      
      const prod1 = result.find(p => p.produto_id === '1');
      const prod2 = result.find(p => p.produto_id === '2');
      const prod3 = result.find(p => p.produto_id === '3');

      expect(prod1.classificacao_abc).toBe('A');
      expect(prod1.percentual).toBeCloseTo(90.09, 1);
    });
  });
});
