const { z } = require('zod');
const dotenv = require('dotenv');
const path = require('path');

// Carrega .env do root do projeto
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  BRAND_NAME: z.string().default('BRIMAJOR'),
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
}).superRefine((value, ctx) => {
  if (value.NODE_ENV !== 'production') return;
  const placeholders = ['dev_jwt_secret', 'dev_refresh_secret', 'replace_in_production'];
  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    if (placeholders.some(token => value[key].toLowerCase().includes(token))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: 'Defina um segredo real para producao',
      });
    }
  }
});

let env;
try {
  env = envSchema.parse(process.env);
} catch (err) {
  const details = typeof err.flatten === 'function'
    ? err.flatten().fieldErrors
    : { _error: [err.message] };
  console.error('Variaveis de ambiente invalidas:', details);
  process.exit(1);
}

module.exports = { env };
