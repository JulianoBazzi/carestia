import { describe, expect, it } from 'vitest';
import {
  accumulateIpca,
  comparePersonalVsIpca,
  computeInflation,
  computeMetrics,
  groupInflationByCategory,
  type IInflationItem,
  type IInflationRow,
  type IMetricsInvoice,
} from '~/services/invoice/analytics';

const d = (s: string) => new Date(s);

describe('computeMetrics', () => {
  const invoices: IMetricsInvoice[] = [
    { model: 'nfe', issuedAt: d('2026-05-10'), totalValue: 10000 },
    { model: 'nfe', issuedAt: d('2026-06-01'), totalValue: 5000 },
    { model: 'nfse', issuedAt: d('2026-06-15'), totalValue: 6000 },
  ];

  it('soma total, conta e ticket médio', () => {
    const m = computeMetrics(invoices);
    expect(m.totalSpent).toBe(21000);
    expect(m.invoiceCount).toBe(3);
    expect(m.avgTicket).toBe(7000);
  });

  it('separa gasto por tipo', () => {
    const m = computeMetrics(invoices);
    expect(m.byType.product).toBe(15000);
    expect(m.byType.service).toBe(6000);
  });

  it('agrupa por mês ordenado', () => {
    const m = computeMetrics(invoices);
    expect(m.perMonth).toEqual([
      { month: '2026-05', total: 10000 },
      { month: '2026-06', total: 11000 },
    ]);
  });

  it('lida com lista vazia', () => {
    const m = computeMetrics([]);
    expect(m).toEqual({
      totalSpent: 0,
      invoiceCount: 0,
      avgTicket: 0,
      byType: { product: 0, service: 0 },
      perMonth: [],
    });
  });
});

describe('computeInflation', () => {
  const rows: IInflationRow[] = [
    {
      itemId: 'a',
      name: 'Gasolina',
      referenceCode: '2710',
      type: 'product',
      issuedAt: d('2026-05-01'),
      unitValue: 500,
    },
    {
      itemId: 'a',
      name: 'Gasolina',
      referenceCode: '2710',
      type: 'product',
      issuedAt: d('2026-06-01'),
      unitValue: 600,
    },
    {
      itemId: 'b',
      name: 'Item único',
      referenceCode: '9999',
      type: 'product',
      issuedAt: d('2026-06-01'),
      unitValue: 1000,
    },
  ];

  it('calcula variação 1º→último por item', () => {
    const { items } = computeInflation(rows);
    const gas = items.find((i) => i.itemId === 'a');
    expect(gas?.firstValue).toBe(500);
    expect(gas?.lastValue).toBe(600);
    expect(gas?.variationPct).toBeCloseTo(0.2); // +20%
    expect(gas?.count).toBe(2);
    expect(gas?.history).toHaveLength(2);
  });

  it('ignora itens com menos de 2 ocorrências', () => {
    const { items } = computeInflation(rows);
    expect(items.find((i) => i.itemId === 'b')).toBeUndefined();
    expect(items).toHaveLength(1);
  });

  it('índice ponderado pelo último preço', () => {
    const { index } = computeInflation(rows);
    // só item 'a' qualifica → índice = variação dele
    expect(index).toBeCloseTo(0.2);
  });

  it('ordena história por data mesmo fora de ordem', () => {
    const unordered: IInflationRow[] = [
      { ...rows[1] }, // junho
      { ...rows[0] }, // maio
    ];
    const { items } = computeInflation(unordered);
    expect(items[0].firstValue).toBe(500);
    expect(items[0].lastValue).toBe(600);
  });

  it('retorna vazio sem recompras', () => {
    const { index, items } = computeInflation([rows[2]]);
    expect(items).toEqual([]);
    expect(index).toBe(0);
  });
});

describe('accumulateIpca', () => {
  it('compõe variações mensais', () => {
    // 1% depois 2% → 1.01*1.02 - 1 = 0.0302
    expect(
      accumulateIpca([
        { month: '2026-05', pct: 1 },
        { month: '2026-06', pct: 2 },
      ]),
    ).toBeCloseTo(0.0302);
  });

  it('retorna 0 para série vazia', () => {
    expect(accumulateIpca([])).toBe(0);
  });
});

describe('comparePersonalVsIpca', () => {
  it('calcula diferença em pontos percentuais', () => {
    const cmp = comparePersonalVsIpca(0.2, [{ month: '2026-06', pct: 10 }]);
    expect(cmp.personal).toBe(0.2);
    expect(cmp.ipca).toBeCloseTo(0.1);
    expect(cmp.diffPp).toBeCloseTo(10); // (0.2-0.1)*100
  });
});

describe('groupInflationByCategory', () => {
  const items: IInflationItem[] = [
    {
      itemId: 'a',
      name: 'Gasolina',
      referenceCode: '2710',
      type: 'product',
      categoryName: 'Combustíveis',
      count: 2,
      firstValue: 500,
      lastValue: 600,
      variationPct: 0.2,
      history: [],
    },
    {
      itemId: 'b',
      name: 'Pão',
      referenceCode: '1905',
      type: 'product',
      count: 2,
      firstValue: 100,
      lastValue: 100,
      variationPct: 0,
      history: [],
    },
  ];

  it('agrupa e usa "Sem categoria" quando ausente', () => {
    const groups = groupInflationByCategory(items);
    const semCat = groups.find((g) => g.category === 'Sem categoria');
    const comb = groups.find((g) => g.category === 'Combustíveis');
    expect(comb?.index).toBeCloseTo(0.2);
    expect(comb?.itemCount).toBe(1);
    expect(semCat?.index).toBe(0);
  });
});
