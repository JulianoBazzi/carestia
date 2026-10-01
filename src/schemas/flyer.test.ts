import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FLYER_MAX_CITIES, flyerObservationsSchema, flyerReadSchema } from '~/schemas/flyer';

const valid = {
  observed_at: '2026-10-01',
  state: 'ms',
  cities: ['Dourados'],
  items: [{ name: 'Arroz Bela Vitta 5kg', unit: 'un', unit_value: 17.98, regular_value: 22.49 }],
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-01T15:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('flyerObservationsSchema', () => {
  it('aceita a entrada válida, normalizando UF e opcionais vazios', () => {
    const out = flyerObservationsSchema.parse({
      ...valid,
      items: [{ ...valid.items[0], item_id: null, unit: '', regular_value: null }],
    });
    expect(out.state).toBe('MS');
    expect(out.items[0]).toEqual({ name: 'Arroz Bela Vitta 5kg', unit_value: 17.98 });
  });

  it('cidades são opcionais (UF inteira)', () => {
    expect(flyerObservationsSchema.parse({ ...valid, cities: undefined }).cities).toEqual([]);
  });

  it('recusa data futura ou inexistente', () => {
    expect(flyerObservationsSchema.safeParse({ ...valid, observed_at: '2026-10-02' }).success).toBe(
      false,
    );
    expect(flyerObservationsSchema.safeParse({ ...valid, observed_at: '2026-02-30' }).success).toBe(
      false,
    );
  });

  it('recusa preço não positivo, cidades demais e lista vazia', () => {
    const zero = { ...valid, items: [{ ...valid.items[0], unit_value: 0 }] };
    expect(flyerObservationsSchema.safeParse(zero).success).toBe(false);
    const cities = Array.from({ length: FLYER_MAX_CITIES + 1 }, (_, i) => `Cidade ${i}`);
    expect(flyerObservationsSchema.safeParse({ ...valid, cities }).success).toBe(false);
    expect(flyerObservationsSchema.safeParse({ ...valid, items: [] }).success).toBe(false);
  });

  it('recusa item_id que não é ULID', () => {
    const bad = { ...valid, items: [{ ...valid.items[0], item_id: 'x' }] };
    expect(flyerObservationsSchema.safeParse(bad).success).toBe(false);
  });
});

describe('flyerReadSchema', () => {
  it('exige data URL JPEG', () => {
    expect(flyerReadSchema.safeParse({ image: 'data:image/jpeg;base64,AAAA' }).success).toBe(true);
    expect(flyerReadSchema.safeParse({ image: 'data:image/png;base64,AAAA' }).success).toBe(false);
  });
});
