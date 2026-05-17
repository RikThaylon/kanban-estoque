/**
 * Factories para criação de dados de teste.
 * Geram objetos com dados válidos para entidades do sistema.
 */
const { v4: uuidv4 } = require('uuid');

let seqCounter = 0;
const seq = () => ++seqCounter;

const factories = {
  produto: (overrides = {}) => ({
    id: uuidv4(),
    codigo: `TST-${String(seq()).padStart(4, '0')}`,
    nome: `Produto Teste ${seq()}`,
    descricao: 'Produto gerado para testes automatizados',
    unidade: 'UN',
    categoria_id: null,
    custo_unitario: 45.00,
    custo_pedido: 150.00,
    taxa_carregamento: 0.20,
    nivel_servico: 95,
    estoque_atual: 100,
    localizacao: 'ALM-01',
    ativo: true,
    classificacao_abc: null,
    criado_por: null,
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
    ...overrides,
  }),

  movimentacao: (overrides = {}) => ({
    id: uuidv4(),
    produto_id: uuidv4(),
    tipo: 'ENTRADA',
    quantidade: 10,
    estoque_antes: 100,
    estoque_depois: 110,
    referencia: null,
    numero_documento: null,
    observacao: null,
    status: 'EXECUTADO',
    criado_por: null,
    aprovado_por: null,
    aprovado_em: null,
    criado_em: new Date().toISOString(),
    ...overrides,
  }),

  pedido: (overrides = {}) => ({
    id: uuidv4(),
    numero: `PC-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(seq()).padStart(4, '0')}`,
    produto_id: uuidv4(),
    fornecedor_id: uuidv4(),
    quantidade_pedida: 100,
    quantidade_recebida: 0,
    preco_unitario: 45.00,
    custo_total: 4500.00,
    status: 'RASCUNHO',
    faixa_no_momento: 'AMARELO',
    estoque_no_momento: 30,
    pr_no_momento: 50,
    data_prevista: null,
    data_emissao: null,
    data_recebimento: null,
    lead_time_real_dias: null,
    departamento_id: null,
    criado_por: null,
    aprovado_por: null,
    ...overrides,
  }),

  fornecedor: (overrides = {}) => ({
    id: uuidv4(),
    nome: `Fornecedor Teste ${seq()}`,
    cnpj: `${String(seq()).padStart(14, '0')}`,
    contato: 'contato@teste.com',
    telefone: '11999999999',
    ativo: true,
    criado_em: new Date().toISOString(),
    ...overrides,
  }),

  departamento: (overrides = {}) => ({
    id: uuidv4(),
    nome: `Departamento Teste ${seq()}`,
    codigo: `DEPT-${String(seq()).padStart(3, '0')}`,
    ativo: true,
    ...overrides,
  }),

  maquina: (overrides = {}) => ({
    id: uuidv4(),
    nome: `Maquina Teste ${seq()}`,
    codigo: `MAQ-${String(seq()).padStart(3, '0')}`,
    departamento_id: null,
    ativo: true,
    ...overrides,
  }),

  usuario: (overrides = {}) => ({
    id: uuidv4(),
    nome: `Usuario Teste ${seq()}`,
    username: `user_test_${seq()}`,
    senha_hash: '$2b$04$test_hash', // bcrypt hash placeholder
    perfil: 'comprador',
    ativo: true,
    tentativas_login: 0,
    bloqueado_ate: null,
    ultimo_login: null,
    criado_em: new Date().toISOString(),
    ...overrides,
  }),

  alerta: (overrides = {}) => ({
    id: uuidv4(),
    produto_id: uuidv4(),
    tipo: 'FAIXA_AMARELO',
    titulo: 'Alerta de teste',
    mensagem: 'Mensagem de teste para alerta',
    severidade: 'AVISO',
    lido: false,
    criado_em: new Date().toISOString(),
    ...overrides,
  }),

  kanbanParametros: (overrides = {}) => ({
    produto_id: uuidv4(),
    demanda_diaria_media: 3.5,
    sigma_demanda_diaria: 0.8,
    lead_time_previsto_dias: 7,
    lead_time_seguro_dias: 9.5,
    sigma_lead_time: 1.2,
    fator_z: 1.6449,
    estoque_seguranca: 7,
    ponto_reposicao: 32,
    eoq: 136,
    estoque_maximo: 143,
    faixa_atual: 'VERDE',
    semanas_historico_usadas: 12,
    pedidos_historico_usados: 8,
    calculado_em: new Date().toISOString(),
    proximo_calculo: new Date().toISOString(),
    ...overrides,
  }),
};

/** Reseta o contador sequencial (usar em beforeEach) */
factories.resetSeq = () => { seqCounter = 0; };

module.exports = factories;
