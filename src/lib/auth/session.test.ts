// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-0123456789-abcdefghij';
});

describe('createToken / verifyToken', () => {
  it('faz roundtrip do payload', async () => {
    const { createToken, verifyToken } = await import('./session');
    const token = await createToken({
      sub: 'user-1',
      name: 'Juliano',
      email: 'juliano@example.com',
    });
    const payload = await verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe('user-1');
    expect(payload?.name).toBe('Juliano');
    expect(payload?.email).toBe('juliano@example.com');
  });

  it('retorna null para token inválido', async () => {
    const { verifyToken } = await import('./session');
    expect(await verifyToken('token.invalido.aqui')).toBeNull();
    expect(await verifyToken('')).toBeNull();
  });

  it('retorna null para token assinado com outro segredo', async () => {
    const { createToken } = await import('./session');
    const token = await createToken({
      sub: 'user-1',
      name: 'X',
      email: 'x@x.com',
    });
    process.env.AUTH_SECRET = 'outro-segredo-totalmente-diferente!';
    const { verifyToken } = await import('./session');
    expect(await verifyToken(token)).toBeNull();
    process.env.AUTH_SECRET = 'test-secret-0123456789-abcdefghij';
  });
});
