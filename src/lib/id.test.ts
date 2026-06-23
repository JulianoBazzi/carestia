import { describe, expect, it } from 'vitest';
import { newId } from '~/lib/id';

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/; // Crockford base32, 26 chars

describe('newId', () => {
  it('gera ULID de 26 caracteres', () => {
    const id = newId();
    expect(id).toHaveLength(26);
    expect(id).toMatch(ULID);
  });

  it('gera ids distintos', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId()));
    expect(ids.size).toBe(1000);
  });

  it('tem prefixo de tempo (10 chars) monotônico não-decrescente', () => {
    const a = newId();
    const b = newId();
    // prefixo de 10 chars = timestamp; o sufixo aleatório não é ordenável no mesmo ms
    expect(b.slice(0, 10) >= a.slice(0, 10)).toBe(true);
  });
});
