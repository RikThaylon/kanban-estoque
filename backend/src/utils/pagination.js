/**
 * Gera parâmetros de paginação para SQL
 * @param {object} query - Query params da requisição
 * @param {number} [defaultLimit=20] - Limite padrão
 * @returns {{ limit: number, offset: number, page: number }}
 */
function parsePagination(query, defaultLimit = 20) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || defaultLimit));
  const offset = (page - 1) * limit;
  return { limit, offset, page };
}

/**
 * Formata resposta paginada
 * @param {Array} data - Dados
 * @param {number} total - Total de registros
 * @param {number} page - Página atual
 * @param {number} limit - Itens por página
 * @returns {object}
 */
function paginatedResponse(data, total, page, limit) {
  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

module.exports = { parsePagination, paginatedResponse };
