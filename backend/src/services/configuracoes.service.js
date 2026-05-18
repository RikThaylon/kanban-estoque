const { query } = require('../config/database');

const CONFIG_DEFAULTS = {
  'pedidos.limite_supervisor': 5000,
  'pedidos.limite_gerente': 50000,
};

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

async function salvarConfiguracoes(configuracoes, usuarioId) {
  const entries = Object.entries(configuracoes);
  for (const [chave, valor] of entries) {
    await query(
      `INSERT INTO configuracoes_sistema (chave, valor, categoria, atualizado_por, atualizado_em)
       VALUES ($1, $2, split_part($1, '.', 1), $3, NOW())
       ON CONFLICT (chave) DO UPDATE SET
         valor = EXCLUDED.valor,
         atualizado_por = EXCLUDED.atualizado_por,
         atualizado_em = NOW()`,
      [chave, String(valor), usuarioId]
    );
  }
}

module.exports = {
  getConfiguracao,
  getLimitesAprovacaoPedido,
  salvarConfiguracoes,
};
