// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetRateLimit,
  checkRateLimit,
  clientIp,
  enforceRateLimit,
  refundRateLimit,
} from '~/lib/rate-limit';

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

describe('enforceRateLimit por usuário', () => {
  beforeEach(() => {
    __resetRateLimit();
  });

  it('isola a cota por conta, mesmo em IPs diferentes', () => {
    const alice = { type: 'user', sub: 'alice' };
    const bob = { type: 'user', sub: 'bob' };
    const opts = { by: 'user' as const };
    expect(enforceRateLimit(makeRequest('1.1.1.1'), 't', 1, WINDOW_MS, alice, opts)).toBeNull();
    // Mesma conta em outro IP: cota já consumida.
    expect(enforceRateLimit(makeRequest('2.2.2.2'), 't', 1, WINDOW_MS, alice, opts)?.status).toBe(
      429,
    );
    // Outra conta no mesmo IP: cota própria.
    expect(enforceRateLimit(makeRequest('1.1.1.1'), 't', 1, WINDOW_MS, bob, opts)).toBeNull();
  });

  it('cai para o IP quando a sessão não tem sub', () => {
    const opts = { by: 'user' as const };
    expect(enforceRateLimit(makeRequest(), 't', 1, WINDOW_MS, { type: 'user' }, opts)).toBeNull();
    expect(enforceRateLimit(makeRequest(), 't', 1, WINDOW_MS, { type: 'user' }, opts)?.status).toBe(
      429,
    );
  });

  it('desconta `cost` unidades e recusa sem consumir quando não cabe', () => {
    const user = { type: 'user', sub: 'u1' };
    expect(
      enforceRateLimit(makeRequest(), 't', 5, WINDOW_MS, user, { by: 'user', cost: 3 }),
    ).toBeNull();
    // 3 + 3 > 5 → recusa, mas não consome.
    expect(
      enforceRateLimit(makeRequest(), 't', 5, WINDOW_MS, user, { by: 'user', cost: 3 })?.status,
    ).toBe(429);
    // Ainda cabem 2.
    expect(
      enforceRateLimit(makeRequest(), 't', 5, WINDOW_MS, user, { by: 'user', cost: 2 }),
    ).toBeNull();
  });
});

describe('clientIp', () => {
  it('usa o IP anexado pelo proxy (mais à direita), não o forjável da esquerda', () => {
    const req = makeRequest('1.2.3.4, 203.0.113.9');
    expect(clientIp(req)).toBe('203.0.113.9');
  });

  it('trocar o X-Forwarded-For forjado não zera o limite', () => {
    __resetRateLimit();
    for (let i = 0; i < 2; i++) {
      expect(
        enforceRateLimit(makeRequest(`9.9.9.${i}, 203.0.113.9`), 'spoof', 2, WINDOW_MS),
      ).toBeNull();
    }
    expect(
      enforceRateLimit(makeRequest('7.7.7.7, 203.0.113.9'), 'spoof', 2, WINDOW_MS),
    ).not.toBeNull();
  });
});

describe('refundRateLimit', () => {
  it('devolve unidades debitadas', () => {
    __resetRateLimit();
    expect(checkRateLimit('k', 2, WINDOW_MS, 2).ok).toBe(true);
    expect(checkRateLimit('k', 2, WINDOW_MS).ok).toBe(false);
    refundRateLimit('k', 1);
    expect(checkRateLimit('k', 2, WINDOW_MS).ok).toBe(true);
  });
});
