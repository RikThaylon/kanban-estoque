/**
 * @file produto.workflow.test.js (expandido)
 * @description Testes para os campos editáveis pelo admin vs. perfis normais
 */

const {
  montarAtualizacaoProduto,
  CAMPOS_ATUALIZAVEIS_PRODUTO,
  CAMPOS_EXCLUSIVOS_ADMIN,
  CAMPOS_ATUALIZAVEIS_ADMIN,
} = require('../../src/services/produto.workflow');

describe('produto.workflow — CAMPOS_ATUALIZAVEIS_ADMIN', () => {
  it('deve conter todos os campos de CAMPOS_ATUALIZAVEIS_PRODUTO', () => {
    for (const campo of CAMPOS_ATUALIZAVEIS_PRODUTO) {
      expect(CAMPOS_ATUALIZAVEIS_ADMIN).toContain(campo);
    }
  });

  it('deve conter campos exclusivos do admin', () => {
    expect(CAMPOS_ATUALIZAVEIS_ADMIN).toContain('codigo');
    expect(CAMPOS_ATUALIZAVEIS_ADMIN).toContain('sku');
    expect(CAMPOS_ATUALIZAVEIS_ADMIN).toContain('estoque_atual');
    expect(CAMPOS_ATUALIZAVEIS_ADMIN).toContain('estoque_minimo');
    expect(CAMPOS_ATUALIZAVEIS_ADMIN).toContain('estoque_maximo');
    expect(CAMPOS_ATUALIZAVEIS_ADMIN).toContain('observacoes');
    expect(CAMPOS_ATUALIZAVEIS_ADMIN).toContain('ativo');
    expect(CAMPOS_ATUALIZAVEIS_ADMIN).toContain('classificacao_abc');
  });

  it('lista de campos exclusivos deve ser subconjunto de admin', () => {
    for (const campo of CAMPOS_EXCLUSIVOS_ADMIN) {
      expect(CAMPOS_ATUALIZAVEIS_ADMIN).toContain(campo);
      // Confirmar que NÃO está na lista normal
      expect(CAMPOS_ATUALIZAVEIS_PRODUTO).not.toContain(campo);
    }
  });
});

describe('montarAtualizacaoProduto — admin vs. perfil normal', () => {
  const payloadCompleto = {
    nome: 'Produto X',
    descricao: 'Desc',
    unidade: 'UN',
    categoria_id: 'cat-123',
    custo_unitario: 10.5,
    custo_pedido: 50,
    taxa_carregamento: 0.2,
    nivel_servico: 95,
    localizacao: 'A-01',
    // Campos exclusivos admin:
    codigo: 'COD-001',
    sku: 'SKU-ABC',
    estoque_atual: 100,
    estoque_minimo: 10,
    estoque_maximo: 500,
    observacoes: 'Obs teste',
    ativo: true,
    classificacao_abc: 'A',
  };

  it('perfil normal não deve incluir campos exclusivos do admin', () => {
    const { fields } = montarAtualizacaoProduto(payloadCompleto, CAMPOS_ATUALIZAVEIS_PRODUTO);
    const camposGerados = fields.map(f => f.split(' = ')[0]);

    for (const campo of CAMPOS_EXCLUSIVOS_ADMIN) {
      expect(camposGerados).not.toContain(campo);
    }
  });

  it('admin deve incluir TODOS os campos do payload', () => {
    const { fields } = montarAtualizacaoProduto(payloadCompleto, CAMPOS_ATUALIZAVEIS_ADMIN);
    const camposGerados = fields.map(f => f.split(' = ')[0]);

    // Campos padrão
    expect(camposGerados).toContain('nome');
    expect(camposGerados).toContain('categoria_id');
    // Campos exclusivos admin
    expect(camposGerados).toContain('codigo');
    expect(camposGerados).toContain('sku');
    expect(camposGerados).toContain('estoque_atual');
    expect(camposGerados).toContain('classificacao_abc');
  });

  it('deve ignorar campos não permitidos mesmo se presentes no payload', () => {
    const payloadComCampoNaoPermitido = {
      nome: 'Teste',
      campo_inventado: 'valor_perigoso',
      __proto__: { malicioso: true },
    };
    const { fields } = montarAtualizacaoProduto(payloadComCampoNaoPermitido, CAMPOS_ATUALIZAVEIS_PRODUTO);
    const camposGerados = fields.map(f => f.split(' = ')[0]);
    expect(camposGerados).toContain('nome');
    expect(camposGerados).not.toContain('campo_inventado');
    expect(camposGerados).not.toContain('__proto__');
  });

  it('deve retornar fields vazio se nenhum campo válido no payload', () => {
    const { fields, values } = montarAtualizacaoProduto({ campo_invalido: 'x' }, CAMPOS_ATUALIZAVEIS_PRODUTO);
    expect(fields).toHaveLength(0);
    expect(values).toHaveLength(0);
  });
});
