const { AppError } = require('../utils/errors');

/**
 * Middleware de Proteção Anti-CSRF baseado na validação de Custom Header.
 * Padrão recomendado pela OWASP para APIs REST protegidas por CORS.
 * Navegadores impedem que formulários HTML de sites de terceiros injetem
 * cabeçalhos customizados, garantindo que a requisição partiu de um cliente
 * legítimo (nosso Frontend via AJAX/fetch).
 */
const antiCsrf = (req, res, next) => {
  const requestedWith = req.get('X-Requested-With');
  
  if (requestedWith !== 'XMLHttpRequest') {
    return next(new AppError('Acesso Negado: Requisição suspeita de CSRF interceptada.', 403));
  }
  
  next();
};

module.exports = { antiCsrf };
