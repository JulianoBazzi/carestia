import { describe, expect, it } from 'vitest';
import { eanCandidates, isCatalogGtin, isValidGtin, normalizeEan } from '~/lib/ean';

describe('normalizeEan', () => {
  it('mantém só dígitos', () => {
    expect(normalizeEan(' 789-1234 567890 ')).toBe('7891234567890');
    expect(normalizeEan(null)).toBe('');
  });
});

describe('isValidGtin', () => {
  it('aceita EAN-13, EAN-8, UPC-A e GTIN-14 com DV correto', () => {
    expect(isValidGtin('7891000315507')).toBe(true); // EAN-13
    expect(isValidGtin('96385074')).toBe(true); // EAN-8
    expect(isValidGtin('036000291452')).toBe(true); // UPC-A
    expect(isValidGtin('17891000315504')).toBe(true); // GTIN-14
  });

  it('rejeita DV errado e tamanhos inválidos', () => {
    expect(isValidGtin('7891000315508')).toBe(false);
    expect(isValidGtin('12345')).toBe(false);
    expect(isValidGtin('')).toBe(false);
  });
});

describe('isCatalogGtin', () => {
  it('aceita GTINs de produto comuns', () => {
    expect(isCatalogGtin('7891000315507')).toBe(true);
    expect(isCatalogGtin('96385074')).toBe(true);
    expect(isCatalogGtin('036000291452')).toBe(true);
    expect(isCatalogGtin('17891000315504')).toBe(true);
  });

  it('rejeita o código zerado, que passa no checksum', () => {
    expect(isValidGtin('0000000000000')).toBe(true);
    expect(isCatalogGtin('0000000000000')).toBe(false);
    expect(isCatalogGtin('00000000')).toBe(false);
  });

  it('rejeita faixas de circulação restrita (balança, uso interno, cupons)', () => {
    expect(isCatalogGtin('2001234000000')).toBe(false); // peso variável
    expect(isCatalogGtin('0201234567899')).toBe(false); // uso interno
    expect(isCatalogGtin('0401234567893')).toBe(false); // regional
    expect(isCatalogGtin('9901234567899')).toBe(false); // cupom
    expect(isCatalogGtin('201234567899')).toBe(false); // UPC-A número 2 (peso)
    expect(isCatalogGtin('401234567893')).toBe(false); // UPC-A número 4 (loja)
    expect(isCatalogGtin('20123451')).toBe(false); // RCN-8
    expect(isCatalogGtin('00123457')).toBe(false); // RCN-8
  });

  it('rejeita DV inválido', () => {
    expect(isCatalogGtin('7891000315508')).toBe(false);
  });
});

describe('eanCandidates', () => {
  it('expande UPC-A com zeros à esquerda', () => {
    expect(eanCandidates('036000291452')).toEqual([
      '036000291452',
      '0036000291452',
      '00036000291452',
    ]);
  });

  it('reduz EAN-13 com zero à esquerda e expande para 14', () => {
    expect(eanCandidates('0036000291452')).toEqual([
      '0036000291452',
      '00036000291452',
      '036000291452',
    ]);
  });

  it('não reduz GTIN-14 com indicador diferente de zero', () => {
    expect(eanCandidates('17891000315504')).toEqual(['17891000315504']);
  });

  it('EAN-8 não se expande', () => {
    expect(eanCandidates('96385074')).toEqual(['96385074']);
  });

  it('entrada inválida devolve lista vazia', () => {
    expect(eanCandidates('abc')).toEqual([]);
    expect(eanCandidates('123')).toEqual([]);
  });
});
