// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-0123456789-abcdefghij';
});

describe('createToken / verifyToken', () => {
  it('faz roundtrip do payload (incluindo o papel)', async () => {
    const { createToken, verifyToken } = await import('./session');
    const token = await createToken({
      sub: 'user-1',
      name: 'Juliano',
      email: 'juliano@example.com',
      type: 'admin',
    });
    const payload = await verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe('user-1');
    expect(payload?.name).toBe('Juliano');
    expect(payload?.email).toBe('juliano@example.com');
    expect(payload?.type).toBe('admin');
  });

  it('degrada type ausente para "user"', async () => {
    const { SignJWT } = await import('jose');
    const { verifyToken } = await import('./session');
    // Token "antigo" sem o claim `type`.
    const token = await new SignJWT({ name: 'X', email: 'x@x.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setExpirationTime('7d')
      .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
    const payload = await verifyToken(token);
    expect(payload?.type).toBe('user');
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
      type: 'user',
    });
    process.env.AUTH_SECRET = 'outro-segredo-totalmente-diferente!';
    const { verifyToken } = await import('./session');
    expect(await verifyToken(token)).toBeNull();
    process.env.AUTH_SECRET = 'test-secret-0123456789-abcdefghij';
  });

  it('recusa segredo curto (< 32 caracteres)', async () => {
    process.env.AUTH_SECRET = 'curto';
    const { createToken } = await import('./session');
    await expect(
      createToken({ sub: 'u', name: 'n', email: 'e@e.com', type: 'user' }),
    ).rejects.toThrow(/AUTH_SECRET muito curto/);
    process.env.AUTH_SECRET = 'test-secret-0123456789-abcdefghij';
  });
});
