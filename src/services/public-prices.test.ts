// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    invoiceItem: { findMany: vi.fn() },
    priceObservation: { findMany: vi.fn() },
    item: { findMany: vi.fn() },
  },
}));

vi.mock('~/lib/prisma', () => ({ default: prismaMock }));

import { getPublicPriceByEan, getPublicPrices } from '~/services/public-prices';

interface Row {
  itemId: string;
  name: string;
  type: 'product' | 'service' | 'energy';
  unit: string | null;
  value: number;
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
    },
  };
}

/** Atalho: N amostras do mesmo item num mês, com os valores informados. */
function samples(values: number[], month = '2026-01', itemId = 'i1') {
  return values.map((value) =>
    row({ itemId, name: 'ARROZ', type: 'product', unit: 'KG', value, month }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Padrão: sem observações de etiqueta e sem item por EAN — os testes que
  // dependem dessas fontes sobrescrevem.
  prismaMock.invoiceItem.findMany.mockResolvedValue([]);
  prismaMock.priceObservation.findMany.mockResolvedValue([]);
  prismaMock.item.findMany.mockResolvedValue([]);
});

describe('getPublicPrices — agregação', () => {
  it('publica item com uma única amostra (não há piso mínimo)', async () => {
    prismaMock.invoiceItem.findMany.mockResolvedValue(samples([6]));

    const { prices } = await getPublicPrices({});
    expect(prices).toHaveLength(1);
    expect(prices[0].itemId).toBe('i1');
    expect(prices[0].avgPrice).toBeCloseTo(6, 5);
    expect(prices[0].samples).toBe(1);
  });

  it('calcula a média sobre todas as amostras do item', async () => {
    prismaMock.invoiceItem.findMany.mockResolvedValue(samples([6, 8, 10]));

    const { prices } = await getPublicPrices({});
    expect(prices).toHaveLength(1);
    expect(prices[0].avgPrice).toBeCloseTo(8, 5);
    expect(prices[0].samples).toBe(3);
  });

  it('monta a série com a média de cada mês, em ordem cronológica', async () => {
    prismaMock.invoiceItem.findMany.mockResolvedValue([
      ...samples([6, 8], '2026-01'), // média 7
      ...samples([99], '2026-02'), // mês de amostra única também entra
      ...samples([10, 20], '2026-03'), // média 15
    ]);

    const { prices } = await getPublicPrices({});
    expect(prices).toHaveLength(1);
    expect(prices[0].series).toEqual([
      { month: '2026-01', value: 7 },
      { month: '2026-02', value: 99 },
      { month: '2026-03', value: 15 },
    ]);
  });

  it('mantém só os 8 meses mais recentes da série', async () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      samples([i + 1], `2026-${String(i + 1).padStart(2, '0')}`),
    ).flat();
    prismaMock.invoiceItem.findMany.mockResolvedValue(rows);

    const { prices } = await getPublicPrices({});
    expect(prices[0].series.map((s) => s.value)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    // Corta os meses mais antigos: começa em março, não em janeiro.
    expect(prices[0].series[0].month).toBe('2026-03');
  });

  it('ordena por número de amostras (desc) e respeita o limite', async () => {
    prismaMock.invoiceItem.findMany.mockResolvedValue([
      ...samples([1], '2026-01', 'raro'),
      ...samples([2, 3, 4], '2026-01', 'comum'),
      ...samples([5, 6], '2026-01', 'medio'),
    ]);

    const { prices } = await getPublicPrices({ limit: 2 });
    expect(prices.map((p) => p.itemId)).toEqual(['comum', 'medio']);
  });

  it('devolve os estados presentes nas notas, ordenados', async () => {
    prismaMock.invoiceItem.findMany.mockResolvedValue([
      row({
        itemId: 'i1',
        name: 'A',
        type: 'product',
        unit: null,
        value: 1,
        month: '2026-01',
        state: 'SP',
      }),
      row({
        itemId: 'i2',
        name: 'B',
        type: 'product',
        unit: null,
        value: 2,
        month: '2026-01',
        state: 'MG',
      }),
      row({
        itemId: 'i3',
        name: 'C',
        type: 'product',
        unit: null,
        value: 3,
        month: '2026-01',
        state: 'SP',
      }),
    ]);

    const { states } = await getPublicPrices({});
    expect(states).toEqual(['MG', 'SP']);
  });

  it('não consulta nem expõe user_id', async () => {
    prismaMock.invoiceItem.findMany.mockResolvedValue(samples([6]));

    const { prices } = await getPublicPrices({});
    const select = prismaMock.invoiceItem.findMany.mock.calls[0][0].select;
    expect(select.invoice.select).not.toHaveProperty('user_id');
    expect(JSON.stringify(prices)).not.toContain('user');
  });
});

describe('getPublicPrices — filtros', () => {
  it('repassa estado, cidade e busca para a query', async () => {
    prismaMock.invoiceItem.findMany.mockResolvedValue([]);

    await getPublicPrices({ state: 'SP', city: 'campinas', search: 'arroz' });

    const where = prismaMock.invoiceItem.findMany.mock.calls[0][0].where;
    expect(where.invoice.state).toBe('SP');
    expect(where.invoice.city).toEqual({ contains: 'campinas', mode: 'insensitive' });
    expect(where.item.name).toEqual({ contains: 'arroz', mode: 'insensitive' });
  });

  it('exclui itens e notas soft-deletados', async () => {
    prismaMock.invoiceItem.findMany.mockResolvedValue([]);

    await getPublicPrices({});

    const where = prismaMock.invoiceItem.findMany.mock.calls[0][0].where;
    expect(where.item.deleted_at).toBeNull();
    expect(where.invoice.deleted_at).toBeNull();
  });
});

/** Observação de etiqueta no formato devolvido pelo select do explorer. */
function observation(o: { itemId?: string; value: number; month?: string; state?: string }) {
  return {
    unit_value: o.value,
    unit: 'KG',
    observed_at: new Date(`${o.month ?? '2026-01'}-20T12:00:00Z`),
    state: o.state ?? 'SP',
    city: 'CAMPINAS',
    ibge_code: null,
    item: { id: o.itemId ?? 'i1', name: 'ARROZ', type: 'product' as const },
  };
}

describe('getPublicPrices — observações de etiqueta', () => {
  it('soma as observações às amostras de nota do mesmo item', async () => {
    prismaMock.invoiceItem.findMany.mockResolvedValue(samples([6, 8]));
    prismaMock.priceObservation.findMany.mockResolvedValue([observation({ value: 10 })]);

    const { prices } = await getPublicPrices({});
    expect(prices).toHaveLength(1);
    expect(prices[0].samples).toBe(3);
    expect(prices[0].avgPrice).toBeCloseTo(8, 5);
  });

  it('inclui em `states` a UF que só aparece em observação', async () => {
    prismaMock.invoiceItem.findMany.mockResolvedValue(samples([6]));
    prismaMock.priceObservation.findMany.mockResolvedValue([
      observation({ value: 7, state: 'BA' }),
    ]);

    const { states } = await getPublicPrices({});
    expect(states).toEqual(['BA', 'SP']);
  });

  it('não seleciona user_id nas observações e aplica os mesmos filtros', async () => {
    await getPublicPrices({ state: 'SP', city: 'campinas', search: 'arroz' });

    const args = prismaMock.priceObservation.findMany.mock.calls[0][0];
    expect(args.select).not.toHaveProperty('user_id');
    expect(JSON.stringify(args.select)).not.toContain('user');
    expect(args.where.deleted_at).toBeNull();
    expect(args.where.item.deleted_at).toBeNull();
    expect(args.where.state).toBe('SP');
    expect(args.where.city).toEqual({ contains: 'campinas', mode: 'insensitive' });
    expect(args.where.item.name).toEqual({ contains: 'arroz', mode: 'insensitive' });
  });
});

const EAN = '7891000315507';

function catalogItem(id = 'i1') {
  return { id, name: 'ARROZ TIPO 1 5KG', unit: 'UN', category: null };
}

function eanInvoiceRow(r: {
  value: number;
  state: string | null;
  city: string | null;
  ibge?: string | null;
  itemId?: string;
  date?: string;
}) {
  return {
    unit_value: r.value,
    unit: 'UN',
    item_id: r.itemId ?? 'i1',
    invoice: {
      issued_at: new Date(r.date ?? '2026-08-10T12:00:00Z'),
      state: r.state,
      city: r.city,
      ibge_code: r.ibge ?? null,
    },
  };
}

function eanObservationRow(r: { value: number; state: string; city: string; date?: string }) {
  return {
    unit_value: r.value,
    unit: 'UN',
    item_id: 'i1',
    observed_at: new Date(r.date ?? '2026-09-01T12:00:00Z'),
    state: r.state,
    city: r.city,
    ibge_code: null,
  };
}

describe('getPublicPriceByEan', () => {
  it('EAN fora do catálogo devolve item nulo sem consultar preços', async () => {
    const result = await getPublicPriceByEan(EAN, { state: 'SP', city: 'Campinas' });

    expect(result.item).toBeNull();
    expect(result.tiers).toBeNull();
    expect(result.region).toEqual({ city: 'CAMPINAS', state: 'SP', ibge_code: null });
    expect(prismaMock.invoiceItem.findMany).not.toHaveBeenCalled();
  });

  it('EAN inválido nem consulta o catálogo', async () => {
    const result = await getPublicPriceByEan('123', {});
    expect(result.item).toBeNull();
    expect(prismaMock.item.findMany).not.toHaveBeenCalled();
  });

  it('busca o catálogo pelas variantes do código (UPC-A acha o EAN-13 com zero)', async () => {
    await getPublicPriceByEan('036000291452', {});

    const where = prismaMock.item.findMany.mock.calls[0][0].where;
    expect(where.ean.in).toEqual(['036000291452', '0036000291452', '00036000291452']);
    expect(where.type).toBe('product');
    expect(where.deleted_at).toBeNull();
  });

  it('monta os recortes cidade/UF/Brasil casando a cidade por nome normalizado', async () => {
    prismaMock.item.findMany.mockResolvedValue([catalogItem()]);
    prismaMock.invoiceItem.findMany.mockResolvedValue([
      eanInvoiceRow({ value: 20, state: 'SP', city: 'CAMPINAS' }),
      eanInvoiceRow({ value: 24, state: 'SP', city: 'SAO PAULO' }),
      eanInvoiceRow({ value: 30, state: 'RS', city: 'PORTO ALEGRE' }),
    ]);
    prismaMock.priceObservation.findMany.mockResolvedValue([
      eanObservationRow({ value: 22, state: 'SP', city: 'CAMPINAS' }),
    ]);

    const { item, tiers } = await getPublicPriceByEan(EAN, { state: 'sp', city: 'Campinas' });

    expect(item?.id).toBe('i1');
    expect(tiers?.city).toMatchObject({ samples: 2, avgPrice: 21, minPrice: 20, maxPrice: 22 });
    expect(tiers?.state?.samples).toBe(3);
    expect(tiers?.state?.avgPrice).toBeCloseTo(22, 5);
    expect(tiers?.country?.samples).toBe(4);
    expect(tiers?.country?.avgPrice).toBeCloseTo(24, 5);
    // A amostra mais recente é a observação de etiqueta.
    expect(tiers?.city?.lastSeenAt).toBe('2026-09-01T12:00:00.000Z');
  });

  it('casa a cidade pelo código IBGE mesmo com grafia diferente', async () => {
    prismaMock.item.findMany.mockResolvedValue([catalogItem()]);
    prismaMock.invoiceItem.findMany.mockResolvedValue([
      eanInvoiceRow({ value: 10, state: 'SP', city: 'S PAULO', ibge: '3550308' }),
    ]);

    const { tiers } = await getPublicPriceByEan(EAN, {
      state: 'SP',
      city: 'São Paulo',
      ibgeCode: '3550308',
    });
    expect(tiers?.city?.samples).toBe(1);
  });

  it('sem região informada só devolve o recorte Brasil', async () => {
    prismaMock.item.findMany.mockResolvedValue([catalogItem()]);
    prismaMock.invoiceItem.findMany.mockResolvedValue([
      eanInvoiceRow({ value: 10, state: 'SP', city: 'CAMPINAS' }),
    ]);

    const { tiers } = await getPublicPriceByEan(EAN);
    expect(tiers?.city).toBeNull();
    expect(tiers?.state).toBeNull();
    expect(tiers?.country?.samples).toBe(1);
  });

  it('cidade sem amostra fica nula e os demais recortes seguem', async () => {
    prismaMock.item.findMany.mockResolvedValue([catalogItem()]);
    prismaMock.invoiceItem.findMany.mockResolvedValue([
      eanInvoiceRow({ value: 10, state: 'SP', city: 'SAO PAULO' }),
    ]);

    const { tiers } = await getPublicPriceByEan(EAN, { state: 'SP', city: 'Campinas' });
    expect(tiers?.city).toBeNull();
    expect(tiers?.state?.samples).toBe(1);
  });

  it('une itens que compartilham o EAN e elege o de mais amostras', async () => {
    prismaMock.item.findMany.mockResolvedValue([catalogItem('i1'), catalogItem('i2')]);
    prismaMock.invoiceItem.findMany.mockResolvedValue([
      eanInvoiceRow({ value: 10, state: 'SP', city: 'CAMPINAS', itemId: 'i1' }),
      eanInvoiceRow({ value: 12, state: 'SP', city: 'CAMPINAS', itemId: 'i2' }),
      eanInvoiceRow({ value: 14, state: 'SP', city: 'CAMPINAS', itemId: 'i2' }),
    ]);

    const { item, tiers } = await getPublicPriceByEan(EAN, { state: 'SP', city: 'CAMPINAS' });
    expect(item?.id).toBe('i2');
    expect(tiers?.country?.samples).toBe(3);
  });

  it('limita a janela de tempo e não seleciona user_id em nenhuma fonte', async () => {
    prismaMock.item.findMany.mockResolvedValue([catalogItem()]);

    await getPublicPriceByEan(EAN, {}, { sinceMonths: 6 });

    const inv = prismaMock.invoiceItem.findMany.mock.calls[0][0];
    const obs = prismaMock.priceObservation.findMany.mock.calls[0][0];
    expect(inv.where.invoice.issued_at.gte).toBeInstanceOf(Date);
    expect(obs.where.observed_at.gte).toBeInstanceOf(Date);
    expect(inv.where.invoice.deleted_at).toBeNull();
    expect(obs.where.deleted_at).toBeNull();
    expect(JSON.stringify(inv.select)).not.toContain('user');
    expect(JSON.stringify(obs.select)).not.toContain('user');
  });
});
