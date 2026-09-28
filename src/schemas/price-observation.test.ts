import { describe, expect, it } from 'vitest';
import { priceObservationSchema } from '~/schemas/price-observation';

const valid = {
  ean: '7891000315507',
  name: 'Leite Condensado',
  unit: 'un',
  unit_value: 7.49,
  city: 'Campinas',
  state: 'sp',
  ibge_code: '3509502',
};

describe('priceObservationSchema', () => {
  it('aceita a entrada válida, normalizando UF e EAN', () => {
    const out = priceObservationSchema.parse({ ...valid, ean: '789-1000 315507' });
    expect(out.ean).toBe('7891000315507');
    expect(out.state).toBe('SP');
  });

  it('nome, unidade e IBGE são opcionais (vazio vira undefined)', () => {
    const out = priceObservationSchema.parse({
      ...valid,
      name: '',
      unit: null,
      ibge_code: null,
    });
    expect(out.name).toBeUndefined();
    expect(out.unit).toBeUndefined();
    expect(out.ibge_code).toBeUndefined();
  });

  it('rejeita EAN com dígito verificador errado', () => {
    const r = priceObservationSchema.safeParse({ ...valid, ean: '7891000315508' });
    expect(r.success).toBe(false);
  });

  it('rejeita preço zero/negativo, UF inexistente e cidade vazia', () => {
    expect(priceObservationSchema.safeParse({ ...valid, unit_value: 0 }).success).toBe(false);
    expect(priceObservationSchema.safeParse({ ...valid, unit_value: -1 }).success).toBe(false);
    expect(priceObservationSchema.safeParse({ ...valid, state: 'XX' }).success).toBe(false);
    expect(priceObservationSchema.safeParse({ ...valid, city: ' ' }).success).toBe(false);
  });
});
