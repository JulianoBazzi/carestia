// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    invoiceItem: { findMany: vi.fn() },
  },
}));

vi.mock('~/lib/prisma', () => ({ default: prismaMock }));

import { getPublicPrices } from '~/services/public-prices';

interface Row {
  itemId: string;
  name: string;
  type: 'product' | 'service' | 'energy';
  unit: string | null;
  value: number;
  userId: string;
  month: string; // "YYYY-MM"
  state?: string;
}

function row(r: Row) {
  return {
    unit_value: r.value,
    unit: r.unit,
    item: { id: r.itemId, name: r.name, type: r.type },
    invoice: {
      issued_at: new Date(`${r.month}-15T12:00:00Z`),
      state: r.state ?? 'SP',
      user_id: r.userId,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getPublicPrices — regra de privacidade (usuários distintos)', () => {
  it('NÃO expõe item com 3 compras de um único usuário', async () => {
    prismaMock.invoiceItem.findMany.mockResolvedValue([
      row({
        itemId: 'i1',
        name: 'ARROZ',
        type: 'product',
        unit: 'KG',
        value: 6,
        userId: 'u1',
        month: '2026-01',
      }),
      row({
        itemId: 'i1',
        name: 'ARROZ',
        type: 'product',
        unit: 'KG',
        value: 6.5,
        userId: 'u1',
        month: '2026-02',
      }),
      row({
        itemId: 'i1',
        name: 'ARROZ',
        type: 'product',
        unit: 'KG',
        value: 7,
        userId: 'u1',
        month: '2026-03',
      }),
    ]);

    const { prices } = await getPublicPrices({});
    expect(prices).toHaveLength(0);
  });

  it('expõe item com 3 usuários distintos', async () => {
    prismaMock.invoiceItem.findMany.mockResolvedValue([
      row({
        itemId: 'i1',
        name: 'ARROZ',
        type: 'product',
        unit: 'KG',
        value: 6,
        userId: 'u1',
        month: '2026-01',
      }),
      row({
        itemId: 'i1',
        name: 'ARROZ',
        type: 'product',
        unit: 'KG',
        value: 8,
        userId: 'u2',
        month: '2026-01',
      }),
      row({
        itemId: 'i1',
        name: 'ARROZ',
        type: 'product',
        unit: 'KG',
        value: 10,
        userId: 'u3',
        month: '2026-01',
      }),
    ]);

    const { prices } = await getPublicPrices({});
    expect(prices).toHaveLength(1);
    expect(prices[0].itemId).toBe('i1');
    expect(prices[0].avgPrice).toBeCloseTo(8, 5);
    expect(prices[0].samples).toBe(3);
  });

  it('série mensal só inclui meses com ≥3 usuários distintos', async () => {
    prismaMock.invoiceItem.findMany.mockResolvedValue([
      // Jan: 3 usuários distintos → aparece na série
      row({
        itemId: 'i1',
        name: 'ARROZ',
        type: 'product',
        unit: 'KG',
        value: 6,
        userId: 'u1',
        month: '2026-01',
      }),
      row({
        itemId: 'i1',
        name: 'ARROZ',
        type: 'product',
        unit: 'KG',
        value: 8,
        userId: 'u2',
        month: '2026-01',
      }),
      row({
        itemId: 'i1',
        name: 'ARROZ',
        type: 'product',
        unit: 'KG',
        value: 10,
        userId: 'u3',
        month: '2026-01',
      }),
      // Fev: só 1 usuário → NÃO aparece na série (mesmo o item passando no piso geral)
      row({
        itemId: 'i1',
        name: 'ARROZ',
        type: 'product',
        unit: 'KG',
        value: 99,
        userId: 'u1',
        month: '2026-02',
      }),
    ]);

    const { prices } = await getPublicPrices({});
    expect(prices).toHaveLength(1);
    // Apenas 1 mês (jan) satisfaz o piso; fev (1 usuário) é omitido.
    expect(prices[0].series).toEqual([8]);
  });
});
