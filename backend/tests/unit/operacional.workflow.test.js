const {
  UUID_REGEX,
  PERFIS_GESTAO_DEPARTAMENTO,
  PERFIS_EXCLUIR_DEPARTAMENTO,
  PERFIS_ADMIN_MAQUINA,
  PERFIS_VINCULAR_MAQUINA,
  CAMPOS_ATUALIZAVEIS_DEPARTAMENTO,
  CAMPOS_ATUALIZAVEIS_MAQUINA,
  normalizarCodigoOperacional,
  nullSeVazio,
  montarAtualizacaoOperacional,
  normalizarVinculoMaquinaProduto,
} = require('../../src/services/operacional.workflow');

describe('operacional.workflow', () => {
  it('centraliza regex de UUID usada por maquinas e departamentos', () => {
    expect(UUID_REGEX.test('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(UUID_REGEX.test('id-invalido')).toBe(false);
  });

  it('centraliza perfis de gestao operacional', () => {
    expect(PERFIS_GESTAO_DEPARTAMENTO).toEqual(['admin', 'gerente_operacoes', 'plant_manager']);
    expect(PERFIS_EXCLUIR_DEPARTAMENTO).toEqual(['admin', 'plant_manager']);
    expect(PERFIS_ADMIN_MAQUINA).toEqual(['admin', 'plant_manager']);
    expect(PERFIS_VINCULAR_MAQUINA).toEqual(['admin', 'plant_manager', 'gerente_operacoes', 'supervisor_turno']);
  });

  it('normaliza codigos operacionais para caixa alta', () => {
    expect(normalizarCodigoOperacional(' maq-01 ')).toBe('MAQ-01');
  });

  it('converte string vazia para null', () => {
    expect(nullSeVazio('')).toBeNull();
    expect(nullSeVazio('abc')).toBe('abc');
    expect(nullSeVazio(false)).toBe(false);
  });

  it('monta atualizacao operacional apenas com campos permitidos', () => {
    const atualizacao = montarAtualizacaoOperacional({
      nome: 'Operacao',
      descricao: '',
      codigo: 'ignorado',
      ativo: false,
    }, CAMPOS_ATUALIZAVEIS_DEPARTAMENTO);

    expect(atualizacao.sets).toEqual(['nome = $1', 'descricao = $2', 'ativo = $3']);
    expect(atualizacao.params).toEqual(['Operacao', null, false]);
  });

  it('mantem campos especificos de maquina fora de departamento', () => {
    expect(CAMPOS_ATUALIZAVEIS_MAQUINA).toContain('departamento_id');
    expect(CAMPOS_ATUALIZAVEIS_MAQUINA).toContain('localizacao');
    expect(CAMPOS_ATUALIZAVEIS_DEPARTAMENTO).toContain('supervisor_id');
    expect(CAMPOS_ATUALIZAVEIS_DEPARTAMENTO).not.toContain('localizacao');
  });

  it('normaliza vinculo de maquina com produto', () => {
    expect(normalizarVinculoMaquinaProduto({
      produto_id: 'prod-1',
      observacao: 'uso diario',
    })).toEqual({
      produto_id: 'prod-1',
      consumo_estimado_diario: 0,
      observacao: 'uso diario',
    });
  });
});
