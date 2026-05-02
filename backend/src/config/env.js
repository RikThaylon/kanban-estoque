const { z } = require('zod');
const dotenv = require('dotenv');
const path = require('path');

// Carrega .env do root do projeto
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_ENABLED: z.enum(['true', 'false']).default('true'),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  RATE_LIMIT_MAX: z.coerce.number().default(200),
});

let env;
try {
  env = envSchema.parse(process.env);
} catch (err) {
  console.error('❌ Variáveis de ambiente inválidas:', err.flatten().fieldErrors);
  process.exit(1);
}

module.exports = { env };
