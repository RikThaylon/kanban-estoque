const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Middleware de auditoria para ações mutantes
 */
const audit = (acao, tabela) => {
  return async (req, res, next) => {
    // Salvar referência ao método json original
    const originalJson = res.json.bind(res);

    res.json = function (data) {
      // Registra audit log após resposta de sucesso
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const registroId = data?.id || data?.data?.id || req.params.id || null;
        const dadosDepois = data?.data || data || null;

        // Remove campos sensíveis do log
        const sanitized = { ...dadosDepois };
        delete sanitized.senha_hash;
        delete sanitized.token;
        delete sanitized.accessToken;
        delete sanitized.refreshToken;

        query(
          `INSERT INTO audit_log (usuario_id, acao, tabela, registro_id, dados_antes, dados_depois, ip) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            req.user?.id || null,
            acao,
            tabela,
            registroId,
            req._dadosAntes ? JSON.stringify(req._dadosAntes) : null,
            JSON.stringify(sanitized),
            req.ip,
          ]
        ).catch(err => logger.error('Erro ao registrar audit log', { error: err.message }));
      }

      return originalJson(data);
    };

    next();
  };
};

module.exports = { audit };
