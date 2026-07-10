// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { normalizeUnit } from '~/lib/units';

describe('normalizeUnit', () => {
  it('canoniza variações de litro (caso combustível L/LT)', () => {
    expect(normalizeUnit('LT')).toBe('L');
    expect(normalizeUnit('lt')).toBe('L');
    expect(normalizeUnit('Litro')).toBe('L');
    expect(normalizeUnit('LITROS')).toBe('L');
    expect(normalizeUnit('L')).toBe('L');
  });

  it('canoniza variações de unidade', () => {
    expect(normalizeUnit('UNID')).toBe('UN');
    expect(normalizeUnit('unidade')).toBe('UN');
    expect(normalizeUnit('UN')).toBe('UN');
  });

  it('colapsa o sufixo "1" de ERP na base canônica', () => {
    expect(normalizeUnit('UN1')).toBe('UN');
    expect(normalizeUnit('KG1')).toBe('KG');
    expect(normalizeUnit('kg1')).toBe('KG');
    expect(normalizeUnit('PC1')).toBe('PC');
    expect(normalizeUnit('FR1')).toBe('FR');
    expect(normalizeUnit('L1')).toBe('L');
    expect(normalizeUnit('CX1')).toBe('CX');
    expect(normalizeUnit('LA1')).toBe('LTA'); // "LA" (lata) + sufixo 1 → LTA
  });

  it('NÃO funde unidades distintas (merge é irreversível)', () => {
    expect(normalizeUnit('PC')).toBe('PC'); // peça ≠ unidade
    expect(normalizeUnit('PCT')).toBe('PCT'); // pacote ≠ peça
    expect(normalizeUnit('CX2')).toBe('CX2'); // caixa com 2 ≠ caixa
    expect(normalizeUnit('CX100')).toBe('CX100'); // caixa com 100 ≠ caixa
    expect(normalizeUnit('M2')).toBe('M2'); // metro² ≠ metro
    expect(normalizeUnit('M3')).toBe('M3'); // metro³ ≠ metro
    expect(normalizeUnit('LATA')).toBe('LTA'); // lata ≠ litro
  });

  it('deixa unidade desconhecida passar direto (normalizada)', () => {
    expect(normalizeUnit('xyz')).toBe('XYZ');
    expect(normalizeUnit('1')).toBe('1');
  });

  it('retorna null para vazio/nulo', () => {
    expect(normalizeUnit(null)).toBeNull();
    expect(normalizeUnit(undefined)).toBeNull();
    expect(normalizeUnit('')).toBeNull();
    expect(normalizeUnit('   ')).toBeNull();
  });
});
