const { query } = require('../config/database');
const logger = require('../utils/logger');
const { sanitizeSensitiveData } = require('../utils/sensitiveData');

const audit = (acao, tabela) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = function (data) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const registroId = data?.id || data?.data?.id || req.params.id || null;
        const dadosDepois = data?.data || data || null;
        const sanitizedAntes = req._dadosAntes ? sanitizeSensitiveData(req._dadosAntes) : null;
        const sanitizedDepois = sanitizeSensitiveData(dadosDepois);

        query(
          `INSERT INTO audit_log (usuario_id, acao, tabela, registro_id, dados_antes, dados_depois, ip)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            req.user?.id || null,
            acao,
            tabela,
            registroId,
            sanitizedAntes ? JSON.stringify(sanitizedAntes) : null,
            JSON.stringify(sanitizedDepois),
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
