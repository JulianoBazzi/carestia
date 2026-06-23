import { describe, expect, it } from 'vitest';
import { fromCents, toCents } from '~/lib/money';

describe('toCents', () => {
  it('converte string decimal para centavos', () => {
    expect(toCents('141.50')).toBe(14150);
    expect(toCents('60.00')).toBe(6000);
  });

  it('arredonda valor unitário de 6 casas', () => {
    expect(toCents('3.680000')).toBe(368);
  });

  it('aceita number', () => {
    expect(toCents(10)).toBe(1000);
    expect(toCents(0)).toBe(0);
  });

  it('arredonda conforme ponto flutuante IEEE-754', () => {
    expect(toCents('1.005')).toBe(100); // 100.4999... → 100
    expect(toCents('1.99')).toBe(199);
    expect(toCents('0.01')).toBe(1);
  });
});

describe('fromCents', () => {
  it('converte centavos para decimal', () => {
    expect(fromCents(14150)).toBe(141.5);
    expect(fromCents(0)).toBe(0);
  });

  it('é inverso de toCents para 2 casas', () => {
    expect(fromCents(toCents('99.99'))).toBe(99.99);
  });
});
