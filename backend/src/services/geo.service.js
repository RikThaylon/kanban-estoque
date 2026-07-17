/**
 * @module geoService
 * @description Serviço de cálculo geográfico usando fórmula Haversine.
 * Utilizado pelo MFA Geográfico para validar localização no login.
 */

const EARTH_RADIUS_METERS = 6_371_000; // Raio médio da Terra em metros

/**
 * Converte graus para radianos.
 * @param {number} degrees
 * @returns {number}
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Calcula a distância entre dois pontos geográficos usando a fórmula Haversine.
 * Resultado preciso para qualquer distância na superfície terrestre.
 *
 * @param {number} lat1 - Latitude do ponto 1 (graus decimais)
 * @param {number} lon1 - Longitude do ponto 1 (graus decimais)
 * @param {number} lat2 - Latitude do ponto 2 (graus decimais)
 * @param {number} lon2 - Longitude do ponto 2 (graus decimais)
 * @returns {number} Distância em metros
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  if (
    typeof lat1 !== 'number' || typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' || typeof lon2 !== 'number'
  ) {
    throw new TypeError('Todos os parâmetros devem ser números');
  }

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Verifica se uma localização está dentro do raio permitido.
 *
 * @param {object} params
 * @param {number} params.userLat - Latitude do usuário
 * @param {number} params.userLon - Longitude do usuário
 * @param {number} params.configLat - Latitude da localização configurada
 * @param {number} params.configLon - Longitude da localização configurada
 * @param {number} params.raioMetros - Raio permitido em metros
 * @returns {{ permitido: boolean, distanciaMetros: number, dentroDoRaio: boolean }}
 */
function verificarLocalizacaoPermitida({ userLat, userLon, configLat, configLon, raioMetros }) {
  const distanciaMetros = haversineDistance(
    Number(userLat), Number(userLon),
    Number(configLat), Number(configLon)
  );

  const dentroDoRaio = distanciaMetros <= raioMetros;

  return {
    permitido: dentroDoRaio,
    distanciaMetros: Math.round(distanciaMetros),
    dentroDoRaio,
  };
}

/**
 * Valida coordenadas geográficas.
 * @param {number} lat
 * @param {number} lon
 * @returns {boolean}
 */
function coordenadasValidas(lat, lon) {
  return (
    Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= -90 && lat <= 90 &&
    lon >= -180 && lon <= 180
  );
}

module.exports = {
  haversineDistance,
  verificarLocalizacaoPermitida,
  coordenadasValidas,
  EARTH_RADIUS_METERS,
};
