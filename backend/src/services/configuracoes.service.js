const { query } = require('../config/database');

const CONFIG_DEFAULTS = {
  'pedidos.limite_supervisor': 5000,
  'pedidos.limite_gerente': 50000,
  'permissoes.cadastrar_item': 'comprador',
  'permissoes.editar_curva_abc': 'eng_producao',
  'permissoes.paginas.dashboard': 'admin,plant_manager,gerente_engenharia,eng_processos,eng_producao,gerente_operacoes,supervisor_turno,comprador,facilitador,visualizador',
  'permissoes.paginas.produtos': 'admin,plant_manager,gerente_engenharia,eng_processos,eng_producao,gerente_operacoes,supervisor_turno,comprador,facilitador,visualizador',
  'permissoes.paginas.movimentacoes': 'admin,gerente_operacoes,supervisor_turno,comprador,facilitador',
  'permissoes.paginas.pedidos': 'admin,gerente_operacoes,supervisor_turno,comprador,facilitador',
  'permissoes.paginas.fornecedores': 'admin,comprador',
  'permissoes.paginas.configuracoes': 'admin',
  'permissoes.paginas.maquinas': 'admin,gerente_operacoes,supervisor_turno,eng_producao',
  'permissoes.paginas.alertas': 'admin,plant_manager,gerente_engenharia,eng_processos,eng_producao,gerente_operacoes,supervisor_turno,comprador,facilitador,visualizador',
  'permissoes.paginas.raci': 'admin,plant_manager,gerente_engenharia,eng_processos,eng_producao,gerente_operacoes,supervisor_turno,comprador,facilitador,visualizador',
  'permissoes.paginas.relatorios': 'admin,gerente_operacoes,gerente_engenharia,plant_manager,comprador,visualizador',
  'permissoes.paginas.usuarios': 'admin,plant_manager,gerente_engenharia,eng_processos,eng_producao,gerente_operacoes',
  'kanban.nivel_servico_padrao': 95,
  'kanban.ciclos_estimativa_inicial': 10,
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
  'fornecedores',
  'configuracoes',
  'maquinas',
  'alertas',
  'raci',
  'relatorios',
  'usuarios',
];

const PERMISSOES_CHAVES = {
  cadastrarItem: 'permissoes.cadastrar_item',
  editarCurvaAbc: 'permissoes.editar_curva_abc',
};

const PERMISSAO_TO_CHAVE = {
  cadastrar_item: PERMISSOES_CHAVES.cadastrarItem,
  editar_curva_abc: PERMISSOES_CHAVES.editarCurvaAbc,
};

function parsePerfis(valor) {
  if (Array.isArray(valor)) return valor.filter(Boolean);
  if (!valor) return [];
  return String(valor).split(',').map((perfil) => perfil.trim()).filter(Boolean);
}

function serializePerfis(perfis) {
  return [...new Set(parsePerfis(perfis))].join(',');
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
  const [nivelServicoPadrao, ciclosEstimativaInicial] = await Promise.all([
    getConfiguracao('kanban.nivel_servico_padrao', CONFIG_DEFAULTS['kanban.nivel_servico_padrao']),
    getConfiguracao('kanban.ciclos_estimativa_inicial', CONFIG_DEFAULTS['kanban.ciclos_estimativa_inicial']),
  ]);

  return {
    nivel_servico_padrao: Number(nivelServicoPadrao) || 95,
    ciclos_estimativa_inicial: Math.min(10, Math.max(3, Number(ciclosEstimativaInicial) || 10)),
  };
}

async function perfilPode(perfil, permissao) {
  if (perfil === 'admin') return true;
  const chave = PERMISSAO_TO_CHAVE[permissao];
  if (!chave) return false;
  const valor = await getConfiguracao(chave, CONFIG_DEFAULTS[chave]);
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
  getConfiguracao,
  getLimitesAprovacaoPedido,
  getKanbanDefaults,
  getTurnosOperacionais,
  getPermissoesOperacionais,
  normalizarTurnos,
  perfilPode,
  serializePerfis,
  salvarConfiguracoes,
};
