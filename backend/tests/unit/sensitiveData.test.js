/**
 * Testes unitários para sensitiveData (hash, encrypt, sanitize)
 * @module tests/unit/sensitiveData.test
 */

// Setup env antes do import
require('../setup');

const {
  hashSensitiveValue,
  encryptValue,
  decryptValue,
  sanitizeSensitiveData,
  hashToken,
  legacyHashToken,
} = require('../../src/utils/sensitiveData');

describe('Sensitive Data Utils', () => {
  describe('hashSensitiveValue', () => {
    it('deve gerar hash com prefixo correto', () => {
      const result = hashSensitiveValue('minha_senha');
      expect(result).toMatch(/^hash:v1:[a-f0-9]{64}$/);
    });

    it('deve retornar null para null', () => {
      expect(hashSensitiveValue(null)).toBeNull();
    });

    it('deve retornar undefined para undefined', () => {
      expect(hashSensitiveValue(undefined)).toBeUndefined();
    });

    it('deve retornar string vazia para string vazia', () => {
      expect(hashSensitiveValue('')).toBe('');
    });

    it('mesmo input deve gerar mesmo hash (determinístico)', () => {
      const h1 = hashSensitiveValue('test123');
      const h2 = hashSensitiveValue('test123');
      expect(h1).toBe(h2);
    });

    it('inputs diferentes devem gerar hashes diferentes', () => {
      const h1 = hashSensitiveValue('senha1');
      const h2 = hashSensitiveValue('senha2');
      expect(h1).not.toBe(h2);
    });
  });

  describe('encryptValue / decryptValue', () => {
    it('deve criptografar e descriptografar corretamente', () => {
      const original = 'dados_sensiveis_123';
      const encrypted = encryptValue(original);
      expect(encrypted).toMatch(/^enc:v1:/);
      
      const decrypted = decryptValue(encrypted);
      expect(decrypted).toBe(original);
    });

    it('deve retornar null/undefined/empty inalterados', () => {
      expect(encryptValue(null)).toBeNull();
      expect(encryptValue(undefined)).toBeUndefined();
      expect(encryptValue('')).toBe('');
    });

    it('decryptValue deve retornar input inalterado se não for payload enc:', () => {
      expect(decryptValue('texto normal')).toBe('texto normal');
      expect(decryptValue(12345)).toBe(12345);
    });

    it('cada criptografia deve gerar resultado diferente (IV aleatório)', () => {
      const e1 = encryptValue('mesmo_texto');
      const e2 = encryptValue('mesmo_texto');
      expect(e1).not.toBe(e2); // IV diferente
      
      // Mas ambos devem descriptografar para o mesmo valor
      expect(decryptValue(e1)).toBe('mesmo_texto');
      expect(decryptValue(e2)).toBe('mesmo_texto');
    });

    it('deve lidar com caracteres especiais e Unicode', () => {
      const original = 'Ação & Manutenção → 日本語 💡';
      const encrypted = encryptValue(original);
      const decrypted = decryptValue(encrypted);
      expect(decrypted).toBe(original);
    });
  });

  describe('sanitizeSensitiveData', () => {
    it('deve hashear campos de senha', () => {
      const input = { nome: 'Teste', senha_hash: 'abc123' };
      const result = sanitizeSensitiveData(input);
      expect(result.nome).toBe('Teste');
      expect(result.senha_hash).toMatch(/^hash:v1:/);
    });

    it('deve hashear campos de token', () => {
      const input = { accessToken: 'jwt_token', refreshToken: 'refresh_jwt' };
      const result = sanitizeSensitiveData(input);
      expect(result.accessToken).toMatch(/^hash:v1:/);
      expect(result.refreshToken).toMatch(/^hash:v1:/);
    });

    it('deve criptografar campos de email', () => {
      const input = { email: 'user@test.com', nome: 'Normal' };
      const result = sanitizeSensitiveData(input);
      expect(result.email).toMatch(/^enc:v1:/);
      expect(result.nome).toBe('Normal');
    });

    it('deve criptografar campos de CNPJ/CPF', () => {
      const input = { cnpj: '12.345.678/0001-90', cpf: '123.456.789-00' };
      const result = sanitizeSensitiveData(input);
      expect(result.cnpj).toMatch(/^enc:v1:/);
      expect(result.cpf).toMatch(/^enc:v1:/);
    });

    it('deve processar objetos aninhados recursivamente', () => {
      const input = {
        usuario: {
          nome: 'Teste',
          email: 'deep@test.com',
          auth: { password: 'secret' },
        },
      };
      const result = sanitizeSensitiveData(input);
      expect(result.usuario.nome).toBe('Teste');
      expect(result.usuario.email).toMatch(/^enc:v1:/);
      expect(result.usuario.auth.password).toMatch(/^hash:v1:/);
    });

    it('deve processar arrays', () => {
      const input = [
        { nome: 'A', email: 'a@test.com' },
        { nome: 'B', email: 'b@test.com' },
      ];
      const result = sanitizeSensitiveData(input);
      expect(result[0].nome).toBe('A');
      expect(result[0].email).toMatch(/^enc:v1:/);
      expect(result[1].email).toMatch(/^enc:v1:/);
    });

    it('deve retornar primitivos inalterados', () => {
      expect(sanitizeSensitiveData('string')).toBe('string');
      expect(sanitizeSensitiveData(123)).toBe(123);
      expect(sanitizeSensitiveData(null)).toBeNull();
    });
  });

  describe('hashToken / legacyHashToken', () => {
    it('hashToken deve gerar hash HMAC hex', () => {
      const result = hashToken('my_token');
      expect(result).toMatch(/^[a-f0-9]{64}$/);
    });

    it('legacyHashToken deve gerar hash SHA256 hex', () => {
      const result = legacyHashToken('my_token');
      expect(result).toMatch(/^[a-f0-9]{64}$/);
    });

    it('hashToken e legacyHashToken devem gerar valores diferentes', () => {
      const h1 = hashToken('same_token');
      const h2 = legacyHashToken('same_token');
      expect(h1).not.toBe(h2);
    });

    it('hashToken deve ser determinístico', () => {
      expect(hashToken('abc')).toBe(hashToken('abc'));
    });
  });
});
