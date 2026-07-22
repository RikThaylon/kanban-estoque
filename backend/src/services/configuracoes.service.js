const { query } = require('../config/database');
const { PERFIS_VALIDOS } = require('../middleware/rbac');
const { AppError } = require('../utils/errors');

const CONFIG_DEFAULTS = {
  'pedidos.limite_supervisor': 5000,
  'pedidos.limite_gerente': 50000,
  'pedidos.solicitantes': 'facilitador,comprador',
  'pedidos.aprovadores_nivel_1': 'supervisor_turno',
  'pedidos.aprovadores_nivel_2': 'gerente_operacoes',
  'pedidos.aprovadores_nivel_3': 'plant_manager',
  'pedidos.compradores': 'comprador',
  'pedidos.recebedores': 'comprador,facilitador',
  'permissoes.cadastrar_item': 'comprador',
  'permissoes.editar_curva_abc': 'eng_producao',
  'permissoes.paginas.dashboard': 'admin,plant_manager,gerente_engenharia,eng_processos,eng_producao,gerente_operacoes,supervisor_turno,comprador,facilitador,visualizador',
  'permissoes.paginas.produtos': 'admin,plant_manager,gerente_engenharia,eng_processos,eng_producao,gerente_operacoes,supervisor_turno,comprador,facilitador,visualizador',
  'permissoes.paginas.movimentacoes': 'admin,gerente_operacoes,supervisor_turno,comprador,facilitador',
  'permissoes.paginas.pedidos': 'admin,gerente_operacoes,supervisor_turno,comprador,facilitador',
  'permissoes.paginas.grafo': 'admin,plant_manager,gerente_engenharia,eng_processos,eng_producao,gerente_operacoes,supervisor_turno,comprador,facilitador,visualizador',
  'permissoes.paginas.fornecedores': 'admin,comprador',
  'permissoes.paginas.configuracoes': 'admin',
  'permissoes.paginas.maquinas': 'admin,gerente_operacoes,supervisor_turno,eng_producao',
  'permissoes.paginas.alertas': 'admin,plant_manager,gerente_engenharia,eng_processos,eng_producao,gerente_operacoes,supervisor_turno,comprador,facilitador,visualizador',
  'permissoes.paginas.raci': 'admin,plant_manager,gerente_engenharia,eng_processos,eng_producao,gerente_operacoes,supervisor_turno,comprador,facilitador,visualizador',
  'permissoes.paginas.relatorios': 'admin,gerente_operacoes,gerente_engenharia,plant_manager,comprador,visualizador',
  'permissoes.paginas.simulacao': 'admin',
  'permissoes.paginas.usuarios': 'admin,plant_manager,gerente_engenharia,eng_processos,eng_producao,gerente_operacoes',
  'permissoes.paginas.seguranca': 'admin',
  'kanban.nivel_servico_padrao': 95,
  'kanban.ciclos_estimativa_inicial': 10,
  'kanban.taxa_carregamento_padrao': 0.2,
  'turnos.lista': JSON.stringify([
    { id: '1T', nome: '1T', inicio: '06:00', fim: '14:00' },
    { id: '2T', nome: '2T', inicio: '14:01', fim: '22:00' },
    { id: '3T', nome: '3T', inicio: '22:01', fim: '05:59' },
  ]),
};

const PAGINAS_SISTEMA = [
  'dashboard',
  'produtos',
  'movimentacoes',
  'pedidos',
  'grafo',
  'fornecedores',
  'configuracoes',
  'maquinas',
  'alertas',
  'raci',
  'relatorios',
  'simulacao',
  'usuarios',
  'seguranca',
];

const PERMISSOES_CHAVES = {
  cadastrarItem: 'permissoes.cadastrar_item',
  editarCurvaAbc: 'permissoes.editar_curva_abc',
};

const PERMISSAO_TO_CHAVE = {
  cadastrar_item: PERMISSOES_CHAVES.cadastrarItem,
  editar_curva_abc: PERMISSOES_CHAVES.editarCurvaAbc,
};
const PERFIS_SEM_APROVACAO_COMPRA = ['comprador', 'facilitador', 'visualizador'];
const PERFIS_SEM_EXECUCAO_FLUXO_COMPRA = ['visualizador'];
const PERFIS_APROVADORES_CONFIGURAVEIS = PERFIS_VALIDOS.filter(
  (perfil) => !['admin', 'comprador', 'facilitador', 'visualizador'].includes(perfil)
);
const PERFIS_FLUXO_COMPRA_CONFIGURAVEIS = PERFIS_VALIDOS.filter(
  (perfil) => !['admin', 'visualizador'].includes(perfil)
);

function parsePerfis(valor) {
  if (Array.isArray(valor)) return valor.filter(Boolean);
  if (!valor) return [];
  return String(valor).split(',').map((perfil) => perfil.trim()).filter(Boolean);
}

function serializePerfis(perfis) {
  return [...new Set(parsePerfis(perfis))].join(',');
}

function perfisSemAdmin(perfis) {
  return parsePerfis(perfis).filter((perfil) => perfil !== 'admin');
}

function formatarRespostaPedidos(limites, cargosFluxo) {
  return {
    limite_supervisor: limites.supervisor,
    limite_gerente: limites.gerente,
    solicitantes: cargosFluxo.solicitantes,
    aprovadores_nivel_1: cargosFluxo.aprovadores.nivel1,
    aprovadores_nivel_2: cargosFluxo.aprovadores.nivel2,
    aprovadores_nivel_3: cargosFluxo.aprovadores.nivel3,
    compradores: cargosFluxo.compradores,
    recebedores: cargosFluxo.recebedores,
  };
}

function montarConfiguracoesPedidos(payload) {
  const limiteSupervisor = Number(payload.limite_supervisor);
  const limiteGerente = Number(payload.limite_gerente);

  if (limiteGerente < limiteSupervisor) {
    throw new AppError('Limite do gerente deve ser maior ou igual ao limite do supervisor', 400, 'LIMITE_INVALIDO');
  }

  const configuracoes = {
    'pedidos.limite_supervisor': limiteSupervisor,
    'pedidos.limite_gerente': limiteGerente,
  };

  const camposPerfis = {
    solicitantes: 'pedidos.solicitantes',
    aprovadores_nivel_1: 'pedidos.aprovadores_nivel_1',
    aprovadores_nivel_2: 'pedidos.aprovadores_nivel_2',
    aprovadores_nivel_3: 'pedidos.aprovadores_nivel_3',
    compradores: 'pedidos.compradores',
    recebedores: 'pedidos.recebedores',
  };

  for (const [campo, chave] of Object.entries(camposPerfis)) {
    if (payload[campo] !== undefined) {
      configuracoes[chave] = serializePerfis(perfisSemAdmin(payload[campo]));
    }
  }

  return {
    configuracoes,
    limites: { supervisor: limiteSupervisor, gerente: limiteGerente },
  };
}

function montarConfiguracoesKanban(payload) {
  const nivelServicoPadrao = Number(payload.nivel_servico_padrao);
  const ciclosEstimativaInicial = Number(payload.ciclos_estimativa_inicial);
  const taxaCarregamentoPadrao = Number(payload.taxa_carregamento_padrao);

  return {
    configuracoes: {
      'kanban.nivel_servico_padrao': nivelServicoPadrao,
      'kanban.ciclos_estimativa_inicial': ciclosEstimativaInicial,
      'kanban.taxa_carregamento_padrao': taxaCarregamentoPadrao,
    },
    resposta: {
      nivel_servico_padrao: nivelServicoPadrao,
      ciclos_estimativa_inicial: ciclosEstimativaInicial,
      taxa_carregamento_padrao: taxaCarregamentoPadrao,
    },
  };
}

function validarTurnosUnicos(turnos) {
  const ids = new Set(turnos.map((turno) => turno.id));
  if (ids.size !== turnos.length) {
    throw new AppError('Cada turno precisa ter um codigo unico', 400, 'TURNO_DUPLICADO');
  }
}

function montarConfiguracoesTurnos(payload) {
  const turnos = normalizarTurnos(payload.turnos);
  validarTurnosUnicos(turnos);
  return {
    turnos,
    configuracoes: {
      'turnos.lista': JSON.stringify(turnos),
    },
  };
}

function montarConfiguracoesPermissoes(payload) {
  const configuracoes = {
    'permissoes.cadastrar_item': serializePerfis(payload.cadastrar_item),
    'permissoes.editar_curva_abc': serializePerfis(payload.editar_curva_abc),
  };

  for (const pagina of PAGINAS_SISTEMA) {
    if (Object.prototype.hasOwnProperty.call(payload.paginas || {}, pagina)) {
      configuracoes[`permissoes.paginas.${pagina}`] = serializePerfis(payload.paginas[pagina]);
    }
  }

  return configuracoes;
}

function normalizarTurnos(valor) {
  const fallback = JSON.parse(CONFIG_DEFAULTS['turnos.lista']);
  let turnos = valor;

  if (typeof valor === 'string') {
    try {
      turnos = JSON.parse(valor);
    } catch {
      return fallback;
    }
  }

  if (!Array.isArray(turnos)) return fallback;

  const normalizados = turnos
    .map((turno) => ({
      id: String(turno?.id || '').trim().slice(0, 20),
      nome: String(turno?.nome || turno?.id || '').trim().slice(0, 40),
      inicio: String(turno?.inicio || '').trim(),
      fim: String(turno?.fim || '').trim(),
    }))
    .filter((turno) => turno.id && turno.nome && /^\d{2}:\d{2}$/.test(turno.inicio) && /^\d{2}:\d{2}$/.test(turno.fim));

  return normalizados.length ? normalizados : fallback;
}

async function getConfiguracao(chave, fallback = null) {
  const result = await query('SELECT valor FROM configuracoes_sistema WHERE chave = $1', [chave]);
  if (result.rows.length === 0) return fallback;
  return result.rows[0].valor;
}

async function getLimitesAprovacaoPedido() {
  const [supervisor, gerente] = await Promise.all([
    getConfiguracao('pedidos.limite_supervisor', CONFIG_DEFAULTS['pedidos.limite_supervisor']),
    getConfiguracao('pedidos.limite_gerente', CONFIG_DEFAULTS['pedidos.limite_gerente']),
  ]);

  return {
    supervisor: Number(supervisor),
    gerente: Number(gerente),
  };
}

function normalizarAprovadoresCompra(aprovadores = {}, options = {}) {
  const incluirAdmin = options.incluirAdmin !== false;
  const nivel1 = parsePerfis(aprovadores.nivel1 ?? CONFIG_DEFAULTS['pedidos.aprovadores_nivel_1']);
  const nivel2 = parsePerfis(aprovadores.nivel2 ?? CONFIG_DEFAULTS['pedidos.aprovadores_nivel_2']);
  const nivel3 = parsePerfis(aprovadores.nivel3 ?? CONFIG_DEFAULTS['pedidos.aprovadores_nivel_3']);
  const normalizar = (perfis) => {
    const elegiveis = perfis.filter((perfil) => !PERFIS_SEM_APROVACAO_COMPRA.includes(perfil));
    return incluirAdmin ? [...elegiveis, 'admin'] : elegiveis.filter((perfil) => perfil !== 'admin');
  };

  return {
    nivel1: [...new Set(normalizar(nivel1))],
    nivel2: [...new Set(normalizar(nivel2))],
    nivel3: [...new Set(normalizar(nivel3))],
  };
}

async function getAprovadoresCompra(options = {}) {
  const [nivel1, nivel2, nivel3] = await Promise.all([
    getConfiguracao('pedidos.aprovadores_nivel_1', CONFIG_DEFAULTS['pedidos.aprovadores_nivel_1']),
    getConfiguracao('pedidos.aprovadores_nivel_2', CONFIG_DEFAULTS['pedidos.aprovadores_nivel_2']),
    getConfiguracao('pedidos.aprovadores_nivel_3', CONFIG_DEFAULTS['pedidos.aprovadores_nivel_3']),
  ]);

  return normalizarAprovadoresCompra({ nivel1, nivel2, nivel3 }, options);
}

function normalizarCargosFluxoCompra(config = {}, options = {}) {
  const incluirAdmin = options.incluirAdmin !== false;
  const normalizar = (valor, chaveDefault, bloqueados = PERFIS_SEM_EXECUCAO_FLUXO_COMPRA) => {
    const perfis = parsePerfis(valor ?? CONFIG_DEFAULTS[chaveDefault])
      .filter((perfil) => !bloqueados.includes(perfil))
      .filter((perfil) => perfil !== 'admin');
    return incluirAdmin ? [...new Set([...perfis, 'admin'])] : [...new Set(perfis)];
  };

  return {
    solicitantes: normalizar(config.solicitantes, 'pedidos.solicitantes'),
    aprovadores: normalizarAprovadoresCompra({
      nivel1: config.nivel1,
      nivel2: config.nivel2,
      nivel3: config.nivel3,
    }, options),
    compradores: normalizar(config.compradores, 'pedidos.compradores'),
    recebedores: normalizar(config.recebedores, 'pedidos.recebedores'),
  };
}

async function getCargosFluxoCompra(options = {}) {
  const [solicitantes, nivel1, nivel2, nivel3, compradores, recebedores] = await Promise.all([
    getConfiguracao('pedidos.solicitantes', CONFIG_DEFAULTS['pedidos.solicitantes']),
    getConfiguracao('pedidos.aprovadores_nivel_1', CONFIG_DEFAULTS['pedidos.aprovadores_nivel_1']),
    getConfiguracao('pedidos.aprovadores_nivel_2', CONFIG_DEFAULTS['pedidos.aprovadores_nivel_2']),
    getConfiguracao('pedidos.aprovadores_nivel_3', CONFIG_DEFAULTS['pedidos.aprovadores_nivel_3']),
    getConfiguracao('pedidos.compradores', CONFIG_DEFAULTS['pedidos.compradores']),
    getConfiguracao('pedidos.recebedores', CONFIG_DEFAULTS['pedidos.recebedores']),
  ]);

  return normalizarCargosFluxoCompra({
    solicitantes,
    nivel1,
    nivel2,
    nivel3,
    compradores,
    recebedores,
  }, options);
}

async function getPermissoesOperacionais() {
  const [cadastrarItem, editarCurvaAbc, ...paginasValues] = await Promise.all([
    getConfiguracao(PERMISSOES_CHAVES.cadastrarItem, CONFIG_DEFAULTS[PERMISSOES_CHAVES.cadastrarItem]),
    getConfiguracao(PERMISSOES_CHAVES.editarCurvaAbc, CONFIG_DEFAULTS[PERMISSOES_CHAVES.editarCurvaAbc]),
    ...PAGINAS_SISTEMA.map((pagina) => getConfiguracao(
      `permissoes.paginas.${pagina}`,
      CONFIG_DEFAULTS[`permissoes.paginas.${pagina}`] || ''
    )),
  ]);

  const paginas = {};
  PAGINAS_SISTEMA.forEach((pagina, index) => {
    paginas[pagina] = parsePerfis(paginasValues[index]);
  });

  return {
    cadastrar_item: parsePerfis(cadastrarItem),
    editar_curva_abc: parsePerfis(editarCurvaAbc),
    paginas,
  };
}

async function getKanbanDefaults() {
  const [nivelServicoPadrao, ciclosEstimativaInicial, taxaCarregamentoPadrao] = await Promise.all([
    getConfiguracao('kanban.nivel_servico_padrao', CONFIG_DEFAULTS['kanban.nivel_servico_padrao']),
    getConfiguracao('kanban.ciclos_estimativa_inicial', CONFIG_DEFAULTS['kanban.ciclos_estimativa_inicial']),
    getConfiguracao('kanban.taxa_carregamento_padrao', CONFIG_DEFAULTS['kanban.taxa_carregamento_padrao']),
  ]);
  const taxaCarregamento = Number(taxaCarregamentoPadrao);

  return {
    nivel_servico_padrao: Number(nivelServicoPadrao) || 95,
    ciclos_estimativa_inicial: Math.min(10, Math.max(3, Number(ciclosEstimativaInicial) || 10)),
    taxa_carregamento_padrao: Number.isFinite(taxaCarregamento)
      ? Math.min(1, Math.max(0, taxaCarregamento))
      : CONFIG_DEFAULTS['kanban.taxa_carregamento_padrao'],
  };
}

async function perfilPode(perfil, permissao) {
  if (perfil === 'admin') return true;
  const chave = PERMISSAO_TO_CHAVE[permissao];
  if (!chave) return false;
  const valor = await getConfiguracao(chave, CONFIG_DEFAULTS[chave]);
  return parsePerfis(valor).includes(perfil);
}

async function perfilTemPagina(perfil, pagina) {
  if (perfil === 'admin') return true;
  if (!perfil || !PAGINAS_SISTEMA.includes(pagina)) return false;
  const chave = `permissoes.paginas.${pagina}`;
  const valor = await getConfiguracao(chave, CONFIG_DEFAULTS[chave] || '');
  return parsePerfis(valor).includes(perfil);
}

async function salvarConfiguracoes(configuracoes, usuarioId) {
  const entries = Object.entries(configuracoes);
  for (const [chave, valor] of entries) {
    const result = await query(
      'UPDATE configuracoes_sistema SET valor = $2 WHERE chave = $1',
      [chave, String(valor)]
    );
    if (result.rowCount === 0) {
      await query(
        'INSERT INTO configuracoes_sistema (chave, valor) VALUES ($1, $2)',
        [chave, String(valor)]
      );
    }
  }
}

async function getTurnosOperacionais() {
  const valor = await getConfiguracao('turnos.lista', CONFIG_DEFAULTS['turnos.lista']);
  return normalizarTurnos(valor);
}

module.exports = {
  CONFIG_DEFAULTS,
  PERMISSOES_CHAVES,
  PAGINAS_SISTEMA,
  PERFIS_APROVADORES_CONFIGURAVEIS,
  PERFIS_FLUXO_COMPRA_CONFIGURAVEIS,
  getConfiguracao,
  getLimitesAprovacaoPedido,
  getAprovadoresCompra,
  getCargosFluxoCompra,
  getKanbanDefaults,
  getTurnosOperacionais,
  getPermissoesOperacionais,
  normalizarTurnos,
  normalizarAprovadoresCompra,
  normalizarCargosFluxoCompra,
  formatarRespostaPedidos,
  montarConfiguracoesPedidos,
  montarConfiguracoesKanban,
  montarConfiguracoesTurnos,
  montarConfiguracoesPermissoes,
  perfilPode,
  perfilTemPagina,
  serializePerfis,
  salvarConfiguracoes,
};
