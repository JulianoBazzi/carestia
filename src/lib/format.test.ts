import { describe, expect, it } from 'vitest';
import { monthKey, parsePrice, toDateInputValue } from '~/lib/format';

describe('parsePrice', () => {
  it('lê o formato brasileiro, com e sem milhar e símbolo', () => {
    expect(parsePrice('12,99')).toBe(12.99);
    expect(parsePrice('1.234,56')).toBe(1234.56);
    expect(parsePrice('R$ 7,5')).toBe(7.5);
  });

  it('aceita ponto decimal', () => {
    expect(parsePrice('12.99')).toBe(12.99);
    expect(parsePrice('8')).toBe(8);
  });

  it('vazio ou sem dígitos vira NaN', () => {
    expect(parsePrice('')).toBeNaN();
    expect(parsePrice('abc')).toBeNaN();
  });
});

describe('monthKey / toDateInputValue (fuso de Brasília)', () => {
  it('compra das 22h do último dia do mês fica no mês da compra', () => {
    // 22h em Cuiabá (-04:00) = 02h UTC do dia seguinte.
    expect(monthKey('2026-06-30T22:00:00-04:00')).toBe('2026-06');
    expect(toDateInputValue('2026-06-30T22:00:00-04:00')).toBe('2026-06-30');
  });

  it('meia-noite UTC do dia 1º ainda é o mês anterior em Brasília', () => {
    expect(monthKey(new Date('2026-07-01T00:00:00Z'))).toBe('2026-06');
  });
});
