import { describe, expect, it } from 'vitest';
import { firstIssue, loginSchema, registerSchema } from '~/lib/validation';

describe('registerSchema', () => {
  it('aceita dados válidos', () => {
    const r = registerSchema.safeParse({
      name: 'Juliano',
      email: 'a@b.com',
      password: '12345678',
    });
    expect(r.success).toBe(true);
  });

  it('normaliza o e-mail (trim + minúsculas) para não duplicar contas', () => {
    const r = registerSchema.safeParse({
      name: 'X',
      email: '  Foo@Example.COM ',
      password: '12345678',
    });
    expect(r.success && r.data.email).toBe('foo@example.com');
  });

  it('rejeita senha acima de 72 caracteres (limite do bcrypt)', () => {
    const r = registerSchema.safeParse({ name: 'X', email: 'a@b.com', password: 'a'.repeat(73) });
    expect(r.success).toBe(false);
  });

  it('rejeita email inválido', () => {
    const r = registerSchema.safeParse({
      name: 'X',
      email: 'nao-email',
      password: '123456',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(firstIssue(r.error)).toBe('E-mail inválido.');
    }
  });

  it('rejeita senha curta', () => {
    const r = registerSchema.safeParse({
      name: 'X',
      email: 'a@b.com',
      password: '123',
    });
    expect(r.success).toBe(false);
  });

  it('rejeita nome vazio', () => {
    const r = registerSchema.safeParse({
      name: '   ',
      email: 'a@b.com',
      password: '123456',
    });
    expect(r.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('exige email e senha', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});
