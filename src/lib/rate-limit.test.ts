// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { __resetRateLimit, enforceRateLimit } from '~/lib/rate-limit';

const WINDOW_MS = 60 * 60 * 1000;

function makeRequest(ip = '10.0.0.1'): Request {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
  });
}

describe('enforceRateLimit', () => {
  beforeEach(() => {
    __resetRateLimit();
  });

  it('retorna 429 com Retry-After quando o limite estoura (sem sessão)', () => {
    expect(enforceRateLimit(makeRequest(), 'test', 2, WINDOW_MS)).toBeNull();
    expect(enforceRateLimit(makeRequest(), 'test', 2, WINDOW_MS)).toBeNull();

    const limited = enforceRateLimit(makeRequest(), 'test', 2, WINDOW_MS);
    expect(limited).not.toBeNull();
    expect(limited?.status).toBe(429);
    expect(Number(limited?.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('aplica o limite a usuário comum', () => {
    const session = { type: 'user' };
    expect(enforceRateLimit(makeRequest(), 'test', 1, WINDOW_MS, session)).toBeNull();
    expect(enforceRateLimit(makeRequest(), 'test', 1, WINDOW_MS, session)?.status).toBe(429);
  });

  it('isenta admin mesmo acima do limite', () => {
    const session = { type: 'admin' };
    for (let i = 0; i < 10; i++) {
      expect(enforceRateLimit(makeRequest(), 'test', 1, WINDOW_MS, session)).toBeNull();
    }
  });

  it('admin não consome a cota do IP compartilhado', () => {
    const admin = { type: 'admin' };
    for (let i = 0; i < 5; i++) {
      enforceRateLimit(makeRequest(), 'test', 2, WINDOW_MS, admin);
    }
    // Usuário comum no mesmo IP/escopo ainda tem a janela inteira disponível.
    expect(enforceRateLimit(makeRequest(), 'test', 2, WINDOW_MS, { type: 'user' })).toBeNull();
    expect(enforceRateLimit(makeRequest(), 'test', 2, WINDOW_MS, { type: 'user' })).toBeNull();
    expect(enforceRateLimit(makeRequest(), 'test', 2, WINDOW_MS, { type: 'user' })?.status).toBe(
      429,
    );
  });
});
