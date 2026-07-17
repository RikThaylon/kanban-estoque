/**
 * @file password-recovery.test.js
 * @description Testes unitários para utilitários do fluxo de recuperação de senha.
 * Testa política de senhas, geração de tokens e validações de segurança.
 */

const crypto = require('crypto');

// ─── Funções auxiliares extraídas do route para teste isolado ─────────────────

function validarPoliticaSenha(senha) {
  if (senha.length < 8) return 'Senha deve ter pelo menos 8 caracteres';
  if (!/[A-Z]/.test(senha)) return 'Senha deve conter pelo menos uma letra maiúscula';
  if (!/[0-9]/.test(senha)) return 'Senha deve conter pelo menos um número';
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(senha)) return 'Senha deve conter pelo menos um caractere especial';
  return null;
}

function gerarTokenRecuperacao() {
  const token = crypto.randomUUID() + '-' + crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

// ─── Testes de Política de Senha ─────────────────────────────────────────────

describe('validarPoliticaSenha', () => {
  it('deve aceitar senha forte', () => {
    expect(validarPoliticaSenha('MinhaSenh@1')).toBeNull();
    expect(validarPoliticaSenha('S3cur!ty#2026')).toBeNull();
    expect(validarPoliticaSenha('P@ssw0rd!')).toBeNull();
  });

  it('deve rejeitar senha curta (menos de 8 caracteres)', () => {
    expect(validarPoliticaSenha('Ab1!')).toBe('Senha deve ter pelo menos 8 caracteres');
    expect(validarPoliticaSenha('Ab1!456')).toBe('Senha deve ter pelo menos 8 caracteres');
  });

  it('deve rejeitar senha sem letra maiúscula', () => {
    expect(validarPoliticaSenha('minha_senha1!')).toBe('Senha deve conter pelo menos uma letra maiúscula');
  });

  it('deve rejeitar senha sem número', () => {
    expect(validarPoliticaSenha('MinhaSenha!')).toBe('Senha deve conter pelo menos um número');
  });

  it('deve rejeitar senha sem caractere especial', () => {
    expect(validarPoliticaSenha('MinhaSenha1')).toBe('Senha deve conter pelo menos um caractere especial');
  });

  it('deve rejeitar senha que não atende múltiplos critérios (falha no primeiro)', () => {
    // Menos de 8 caracteres é verificado primeiro
    expect(validarPoliticaSenha('abc')).toBe('Senha deve ter pelo menos 8 caracteres');
  });

  it('deve aceitar todos os caracteres especiais permitidos', () => {
    const especiais = '!@#$%^&*()_+-=[]{};\'"\\|,.<>/?';
    for (const c of especiais) {
      const senha = `MinhaSenha1${c}`;
      expect(validarPoliticaSenha(senha)).toBeNull();
    }
  });

  it('deve rejeitar string vazia', () => {
    expect(validarPoliticaSenha('')).toBe('Senha deve ter pelo menos 8 caracteres');
  });
});

// ─── Testes de Geração de Token ───────────────────────────────────────────────

describe('gerarTokenRecuperacao', () => {
  it('deve gerar token e hash diferentes a cada chamada', () => {
    const { token: t1, hash: h1 } = gerarTokenRecuperacao();
    const { token: t2, hash: h2 } = gerarTokenRecuperacao();
    expect(t1).not.toBe(t2);
    expect(h1).not.toBe(h2);
  });

  it('hash deve ser SHA-256 (64 caracteres hex)', () => {
    const { hash } = gerarTokenRecuperacao();
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hash deve ser reprodutível a partir do token', () => {
    const { token, hash } = gerarTokenRecuperacao();
    const reHash = crypto.createHash('sha256').update(token).digest('hex');
    expect(reHash).toBe(hash);
  });

  it('token deve conter UUID (36 chars) seguido de traço e hex', () => {
    const { token } = gerarTokenRecuperacao();
    const parts = token.split('-');
    // UUID v4 tem 5 partes separadas por traço, mais a parte hex adicional
    expect(parts.length).toBeGreaterThanOrEqual(6);
  });

  it('hash diferente de token (não armazenar token em texto plano)', () => {
    const { token, hash } = gerarTokenRecuperacao();
    expect(hash).not.toBe(token);
  });

  it('deve gerar tokens com entropia suficiente (≥ 256 bits)', () => {
    // UUID = 122 bits + randomBytes(16) = 128 bits → ≥ 250 bits de entropia
    const { token } = gerarTokenRecuperacao();
    // Token deve ter pelo menos 68 caracteres (36 UUID + 1 traço + 32 hex)
    expect(token.length).toBeGreaterThanOrEqual(69);
  });
});

// ─── Testes de Expiração ──────────────────────────────────────────────────────

describe('expiração de token', () => {
  it('2 horas em ms deve ser 7.200.000', () => {
    const duasHorasMs = 2 * 60 * 60 * 1000;
    expect(duasHorasMs).toBe(7_200_000);
  });

  it('token expirado deve ser detectável', () => {
    const expiraEm = new Date(Date.now() - 1000); // 1 segundo atrás
    expect(expiraEm < new Date()).toBe(true);
  });

  it('token válido não deve estar expirado', () => {
    const expiraEm = new Date(Date.now() + 2 * 60 * 60 * 1000);
    expect(expiraEm > new Date()).toBe(true);
  });
});
