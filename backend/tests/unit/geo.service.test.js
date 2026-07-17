/**
 * @file geo.service.test.js
 * @description Testes unitários para o serviço de geolocalização (Haversine).
 * Valida cálculos com casos reais conhecidos e casos extremos.
 */

const {
  haversineDistance,
  verificarLocalizacaoPermitida,
  coordenadasValidas,
  EARTH_RADIUS_METERS,
} = require('../../src/services/geo.service');

describe('geoService — haversineDistance', () => {
  it('deve retornar 0 para o mesmo ponto', () => {
    const d = haversineDistance(-23.55052, -46.633309, -23.55052, -46.633309);
    expect(d).toBe(0);
  });

  it('deve calcular distância São Paulo → Rio de Janeiro (~357 km)', () => {
    // SP: -23.5505, -46.6333 | RJ: -22.9068, -43.1729
    const d = haversineDistance(-23.5505, -46.6333, -22.9068, -43.1729);
    // Tolerância de ±5 km para valores geográficos aproximados
    expect(d).toBeGreaterThan(352_000);
    expect(d).toBeLessThan(362_000);
  });

  it('deve calcular distância Londres → Paris (~343 km)', () => {
    // London: 51.5074, -0.1278 | Paris: 48.8566, 2.3522
    const d = haversineDistance(51.5074, -0.1278, 48.8566, 2.3522);
    expect(d).toBeGreaterThan(337_000);
    expect(d).toBeLessThan(349_000);
  });

  it('deve calcular distância muito curta com precisão (100 metros aprox)', () => {
    // Dois pontos próximos em São Paulo
    // 0.001° de latitude ≈ 111 metros
    const d = haversineDistance(-23.550, -46.633, -23.551, -46.633);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(130);
  });

  it('deve funcionar com coordenadas no hemisfério norte', () => {
    // New York: 40.7128, -74.0060 | Chicago: 41.8781, -87.6298
    const d = haversineDistance(40.7128, -74.0060, 41.8781, -87.6298);
    expect(d).toBeGreaterThan(1_100_000); // ~1.100 km
    expect(d).toBeLessThan(1_300_000);
  });

  it('deve funcionar com coordenadas cruzando o meridiano de Greenwich', () => {
    const d = haversineDistance(51.5, -0.1, 51.5, 0.1);
    expect(d).toBeGreaterThan(10_000);
    expect(d).toBeLessThan(20_000);
  });

  it('deve lançar TypeError para coordenadas não numéricas', () => {
    expect(() => haversineDistance('lat', -46.63, -23.55, -46.63)).toThrow(TypeError);
    expect(() => haversineDistance(-23.55, null, -23.55, -46.63)).toThrow(TypeError);
    expect(() => haversineDistance(-23.55, -46.63, undefined, -46.63)).toThrow(TypeError);
  });

  it('deve retornar valor em metros (raio da Terra constante correto)', () => {
    expect(EARTH_RADIUS_METERS).toBe(6_371_000);
  });

  it('é simétrico: dist(A,B) === dist(B,A)', () => {
    const a = haversineDistance(-23.55, -46.63, -22.90, -43.17);
    const b = haversineDistance(-22.90, -43.17, -23.55, -46.63);
    expect(Math.abs(a - b)).toBeLessThan(0.001); // Diferença de ponto flutuante negligenciável
  });
});

describe('geoService — verificarLocalizacaoPermitida', () => {
  const configBase = {
    configLat: -23.55052,
    configLon: -46.633309,
  };

  it('deve permitir quando usuário está dentro do raio (500m)', () => {
    // Usuário ~100m do centro
    const resultado = verificarLocalizacaoPermitida({
      ...configBase,
      userLat: -23.55142,  // ~100m
      userLon: -46.633309,
      raioMetros: 500,
    });
    expect(resultado.permitido).toBe(true);
    expect(resultado.dentroDoRaio).toBe(true);
    expect(resultado.distanciaMetros).toBeLessThan(500);
  });

  it('deve bloquear quando usuário está fora do raio (500m)', () => {
    // Usuário ~1km do centro
    const resultado = verificarLocalizacaoPermitida({
      ...configBase,
      userLat: -23.5595,   // ~1km
      userLon: -46.633309,
      raioMetros: 500,
    });
    expect(resultado.permitido).toBe(false);
    expect(resultado.dentroDoRaio).toBe(false);
    expect(resultado.distanciaMetros).toBeGreaterThan(500);
  });

  it('deve permitir quando usuário está exatamente no centro (distância 0)', () => {
    const resultado = verificarLocalizacaoPermitida({
      ...configBase,
      userLat: -23.55052,
      userLon: -46.633309,
      raioMetros: 100,
    });
    expect(resultado.permitido).toBe(true);
    expect(resultado.distanciaMetros).toBe(0);
  });

  it('deve retornar distanciaMetros como inteiro', () => {
    const resultado = verificarLocalizacaoPermitida({
      ...configBase,
      userLat: -23.5600,
      userLon: -46.6333,
      raioMetros: 1000,
    });
    expect(Number.isInteger(resultado.distanciaMetros)).toBe(true);
  });

  it('deve funcionar com raio grande (50km)', () => {
    // Usuário em São Paulo, config em São Paulo
    const resultado = verificarLocalizacaoPermitida({
      ...configBase,
      userLat: -23.6,
      userLon: -46.7,
      raioMetros: 50_000,
    });
    expect(resultado.permitido).toBe(true);
  });
});

describe('geoService — coordenadasValidas', () => {
  it('deve aceitar coordenadas válidas', () => {
    expect(coordenadasValidas(-23.55, -46.63)).toBe(true);
    expect(coordenadasValidas(0, 0)).toBe(true);
    expect(coordenadasValidas(90, 180)).toBe(true);
    expect(coordenadasValidas(-90, -180)).toBe(true);
  });

  it('deve rejeitar latitude fora do intervalo', () => {
    expect(coordenadasValidas(91, 0)).toBe(false);
    expect(coordenadasValidas(-91, 0)).toBe(false);
  });

  it('deve rejeitar longitude fora do intervalo', () => {
    expect(coordenadasValidas(0, 181)).toBe(false);
    expect(coordenadasValidas(0, -181)).toBe(false);
  });

  it('deve rejeitar NaN e Infinity', () => {
    expect(coordenadasValidas(NaN, 0)).toBe(false);
    expect(coordenadasValidas(0, Infinity)).toBe(false);
    expect(coordenadasValidas(-Infinity, 0)).toBe(false);
  });
});
