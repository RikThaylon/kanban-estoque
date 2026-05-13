const crypto = require('crypto');
const { env } = require('../config/env');

const HASH_ALGORITHM = 'sha256';
const ENC_ALGORITHM = 'aes-256-gcm';
const TOKEN_VERSION = 'v1';

const HASHED_KEYS = /(senha|password|token|secret|authorization|cookie|jwt|api[_-]?key)/i;
const ENCRYPTED_KEYS = /(email|telefone|phone|cnpj|cpf|contato|user_agent|ip_origem|ip|documento)/i;

const getEncryptionKey = () => {
  const source = env.DATA_ENCRYPTION_SECRET || env.JWT_SECRET;
  return crypto.createHash(HASH_ALGORITHM).update(source).digest();
};

const hashSensitiveValue = (value) => {
  if (value === null || value === undefined || value === '') return value;
  return `hash:${TOKEN_VERSION}:${crypto
    .createHmac(HASH_ALGORITHM, env.JWT_REFRESH_SECRET)
    .update(String(value))
    .digest('hex')}`;
};

const encryptValue = (value) => {
  if (value === null || value === undefined || value === '') return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENC_ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(String(value), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `enc:${TOKEN_VERSION}:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
};

const decryptValue = (payload) => {
  if (typeof payload !== 'string' || !payload.startsWith(`enc:${TOKEN_VERSION}:`)) return payload;
  const [, , ivRaw, tagRaw, encryptedRaw] = payload.split(':');
  const decipher = crypto.createDecipheriv(ENC_ALGORITHM, getEncryptionKey(), Buffer.from(ivRaw, 'base64'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64')),
    decipher.final(),
  ]).toString('utf8');
};

const sanitizeSensitiveData = (value) => {
  if (Array.isArray(value)) return value.map(sanitizeSensitiveData);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (HASHED_KEYS.test(key)) return [key, hashSensitiveValue(item)];
      if (ENCRYPTED_KEYS.test(key)) return [key, encryptValue(item)];
      return [key, sanitizeSensitiveData(item)];
    })
  );
};

const legacyHashToken = (token) => crypto.createHash(HASH_ALGORITHM).update(token).digest('hex');
const hashToken = (token) => crypto.createHmac(HASH_ALGORITHM, env.JWT_REFRESH_SECRET).update(token).digest('hex');

module.exports = {
  decryptValue,
  encryptValue,
  hashSensitiveValue,
  hashToken,
  legacyHashToken,
  sanitizeSensitiveData,
};
