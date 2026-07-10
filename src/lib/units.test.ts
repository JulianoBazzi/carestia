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
    expect(normalizeUnit('UN1')).toBe('UN');
    expect(normalizeUnit('UNID')).toBe('UN');
    expect(normalizeUnit('unidade')).toBe('UN');
    expect(normalizeUnit('UN')).toBe('UN');
  });

  it('NÃO funde unidades distintas (merge é irreversível)', () => {
    expect(normalizeUnit('PC')).toBe('PC'); // peça ≠ unidade
    expect(normalizeUnit('PCT')).toBe('PCT'); // pacote ≠ peça
    expect(normalizeUnit('CX2')).toBe('CX2'); // caixa com 2 ≠ caixa
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
