const Redis = require('ioredis');
const { env } = require('./env');
const logger = require('../utils/logger');

// Stub em memória usado quando REDIS_ENABLED=false (dev local sem Redis).
// Atende a API mínima usada pelo projeto: get / set / setex / del.
function criarStubMemoria() {
  const store = new Map();
  return {
    isStub: true,
    async get(key) {
      const item = store.get(key);
      if (!item) return null;
      if (item.exp && item.exp < Date.now()) {
        store.delete(key);
        return null;
      }
      return item.value;
    },
    async setex(key, seconds, value) {
      store.set(key, { value, exp: Date.now() + seconds * 1000 });
      return 'OK';
    },
    async set(key, value) {
      store.set(key, { value, exp: null });
      return 'OK';
    },
    async del(key) {
      return store.delete(key) ? 1 : 0;
    },
    on() { /* noop */ },
    async connect() { /* noop */ },
    async quit() { /* noop */ },
  };
}

const redisDesativado = String(process.env.REDIS_ENABLED || 'true').toLowerCase() === 'false';

let redis;

if (redisDesativado) {
  logger.warn('Redis DESATIVADO (REDIS_ENABLED=false) — usando stub em memória. Use somente em dev.');
  redis = criarStubMemoria();
} else {
  redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 5000);
      return delay;
    },
    lazyConnect: true,
  });

  redis.on('connect', () => logger.info('Redis conectado'));
  redis.on('error', (err) => logger.error('Redis erro', { error: err.message }));
  redis.on('close', () => logger.warn('Redis desconectado'));
}

const connectRedis = async () => {
  if (redis.isStub) return;
  try {
    await redis.connect();
  } catch (err) {
    logger.error('Falha ao conectar Redis', { error: err.message });
    if (env.NODE_ENV === 'production') throw err;
  }
};

module.exports = { redis, connectRedis };
