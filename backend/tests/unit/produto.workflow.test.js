const {
  CAMPOS_ATUALIZAVEIS_PRODUTO,
  CUSTO_PEDIDO_PADRAO,
  SEMANAS_HISTORICO_MAX,
  valorFoiInformado,
  resolverParametrosCadastroProduto,
  montarAtualizacaoProduto,
  normalizarVinculoFornecedorProduto,
  normalizarListaFornecedoresProduto,
  limitarSemanasHistorico,
} = require('../../src/services/produto.workflow');

describe('produto.workflow', () => {
  describe('cadastro de produto', () => {
    it('aplica defaults de Kanban quando parametros opcionais nao sao informados', () => {
      const params = resolverParametrosCadastroProduto({}, {
        nivel_servico_padrao: 95,
        taxa_carregamento_padrao: 0.2,
      });

      expect(params).toEqual({
        nivelServicoFinal: 95,
        custoPedidoFinal: CUSTO_PEDIDO_PADRAO,
        taxaCarregamentoFinal: 0.2,
        cmdInicial: 0,
        leadTimeInicial: 0,
      });
    });

    it('usa valores informados no payload', () => {
      const params = resolverParametrosCadastroProduto({
        nivel_servico: '98',
        custo_pedido: '150',
        taxa_carregamento: '0.35',
        cmd_inicial: '6',
        lead_time_inicial: '8',
      }, {
        nivel_servico_padrao: 95,
        taxa_carregamento_padrao: 0.2,
      });

      expect(params.nivelServicoFinal).toBe(98);
      expect(params.custoPedidoFinal).toBe(150);
      expect(params.taxaCarregamentoFinal).toBe(0.35);
      expect(params.cmdInicial).toBe(6);
      expect(params.leadTimeInicial).toBe(8);
    });

    it('distingue valores vazios de valores numericos validos', () => {
      expect(valorFoiInformado('')).toBe(false);
      expect(valorFoiInformado(undefined)).toBe(false);
      expect(valorFoiInformado(null)).toBe(false);
      expect(valorFoiInformado(0)).toBe(true);
    });
  });

  describe('atualizacao de produto', () => {
    it('mantem lista explicita de campos atualizaveis', () => {
      expect(CAMPOS_ATUALIZAVEIS_PRODUTO).toEqual(expect.arrayContaining(['nome', 'custo_unitario', 'nivel_servico', 'localizacao']));
      expect(CAMPOS_ATUALIZAVEIS_PRODUTO).not.toContain('codigo');
      expect(CAMPOS_ATUALIZAVEIS_PRODUTO).not.toContain('estoque_atual');
    });

    it('monta atualizacao apenas com campos permitidos', () => {
      const atualizacao = montarAtualizacaoProduto({
        nome: 'Produto QA',
        estoque_atual: 999,
        nivel_servico: 99,
      });

      expect(atualizacao.fields).toEqual(['nome = $1', 'nivel_servico = $2']);
      expect(atualizacao.values).toEqual(['Produto QA', 99]);
      expect(atualizacao.nextIndex).toBe(3);
    });
  });

  describe('fornecedores de produto', () => {
    it('exige fornecedor_id para criar vinculo', () => {
      expect(() => normalizarVinculoFornecedorProduto({ prioridade: 1 })).toThrow('fornecedor_id');
    });

    it('aplica prioridade padrao quando nao informada', () => {
      const vinculo = normalizarVinculoFornecedorProduto({
        fornecedor_id: 'forn-1',
        preco_acordado: 15,
      });

      expect(vinculo).toEqual({
        fornecedor_id: 'forn-1',
        prioridade: 1,
        preco_acordado: 15,
        lead_time_nominal_dias: undefined,
      });
    });

    it('normaliza lista de fornecedores', () => {
      expect(normalizarListaFornecedoresProduto([
        { fornecedor_id: 'forn-1' },
        { fornecedor_id: 'forn-2', prioridade: 2 },
      ])).toEqual([
        { fornecedor_id: 'forn-1', prioridade: 1, preco_acordado: undefined, lead_time_nominal_dias: undefined },
        { fornecedor_id: 'forn-2', prioridade: 2, preco_acordado: undefined, lead_time_nominal_dias: undefined },
      ]);
    });

    it('rejeita payload de fornecedores que nao seja lista', () => {
      expect(() => normalizarListaFornecedoresProduto(null)).toThrow('fornecedores deve ser uma lista');
    });
  });

  describe('historico de consumo', () => {
    it('limita janela consultavel entre 1 e 52 semanas', () => {
      expect(limitarSemanasHistorico(undefined)).toBe(12);
      expect(limitarSemanasHistorico(0)).toBe(12);
      expect(limitarSemanasHistorico('-5')).toBe(1);
      expect(limitarSemanasHistorico('200')).toBe(SEMANAS_HISTORICO_MAX);
      expect(limitarSemanasHistorico('8')).toBe(8);
    });
  });
});
