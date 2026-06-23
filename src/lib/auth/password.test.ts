import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '~/lib/auth/password';

describe('hashPassword / verifyPassword', () => {
  it('gera hash diferente do texto puro', async () => {
    const hash = await hashPassword('s3nh4-forte');
    expect(hash).not.toBe('s3nh4-forte');
    expect(hash.length).toBeGreaterThan(50);
  });

  it('verifica senha correta', async () => {
    const hash = await hashPassword('s3nh4-forte');
    expect(await verifyPassword('s3nh4-forte', hash)).toBe(true);
  });

  it('rejeita senha incorreta', async () => {
    const hash = await hashPassword('s3nh4-forte');
    expect(await verifyPassword('errada', hash)).toBe(false);
  });

  it('gera hashes distintos (salt) para a mesma senha', async () => {
    const a = await hashPassword('igual');
    const b = await hashPassword('igual');
    expect(a).not.toBe(b);
    expect(await verifyPassword('igual', a)).toBe(true);
    expect(await verifyPassword('igual', b)).toBe(true);
  });
});
