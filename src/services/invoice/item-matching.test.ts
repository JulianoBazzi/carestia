// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { matchKey } from '~/lib/normalize';
import { PRICE_MATCH_MAX_RATIO, priceWithinBand } from '~/services/invoice/item-matching';

describe('priceWithinBand', () => {
  const f = PRICE_MATCH_MAX_RATIO; // 5

  it('passa quando não há histórico (mediana nula)', () => {
    expect(priceWithinBand(6, null, f)).toBe(true);
    expect(priceWithinBand(6, undefined, f)).toBe(true);
  });

  it('passa para preços dentro da faixa (inflação/variação normal)', () => {
    expect(priceWithinBand(6, 6, f)).toBe(true);
    expect(priceWithinBand(7.2, 6, f)).toBe(true); // +20%
    expect(priceWithinBand(30, 6, f)).toBe(true); // 5× exato (limite)
    expect(priceWithinBand(6, 30, f)).toBe(true); // 1/5 exato (limite)
  });

  it('rejeita produtos de faixas incompatíveis (o caso 1000 vs 10)', () => {
    expect(priceWithinBand(1000, 10, f)).toBe(false);
    expect(priceWithinBand(10, 1000, f)).toBe(false);
    expect(priceWithinBand(60, 6, f)).toBe(false); // 10×
  });

  it('passa (não bloqueia) para valores inválidos ≤ 0', () => {
    expect(priceWithinBand(0, 6, f)).toBe(true);
    expect(priceWithinBand(-1, 6, f)).toBe(true);
    expect(priceWithinBand(6, 0, f)).toBe(true);
    expect(priceWithinBand(null, 6, f)).toBe(true);
  });
});

describe('matchKey', () => {
  it('colapsa variações de escrita do mesmo produto', () => {
    const variants = ['DIESEL S-10', 'DIESEL S10', 'Diesel S-10.', 'diesel  s-10'];
    const keys = variants.map(matchKey);
    for (const k of keys) {
      expect(k).toBe('DIESEL S10');
    }
  });

  it('remove acento, pontuação e espaços redundantes', () => {
    expect(matchKey('Óleo Diesel B S-10 - Comum')).toBe('OLEO DIESEL B S10 COMUM');
  });

  it('retorna string vazia para entrada vazia/nula', () => {
    expect(matchKey(null)).toBe('');
    expect(matchKey('')).toBe('');
    expect(matchKey('   ')).toBe('');
  });
});
