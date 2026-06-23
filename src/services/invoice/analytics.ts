// Funções puras de agregação (sem DB) — testáveis isoladamente.

export interface IMetricsInvoice {
  model: 'nfe' | 'nfse';
  issuedAt: Date;
  totalValue: number; // centavos
}

export interface IMetrics {
  totalSpent: number; // centavos
  invoiceCount: number;
  avgTicket: number; // centavos
  byType: { product: number; service: number }; // centavos
  perMonth: Array<{ month: string; total: number }>; // month = "YYYY-MM", total em centavos
}

export function computeMetrics(invoices: IMetricsInvoice[]): IMetrics {
  const totalSpent = invoices.reduce((acc, i) => acc + i.totalValue, 0);
  const invoiceCount = invoices.length;
  const avgTicket = invoiceCount === 0 ? 0 : Math.round(totalSpent / invoiceCount);

  const byType = { product: 0, service: 0 };
  const monthMap = new Map<string, number>();

  for (const inv of invoices) {
    if (inv.model === 'nfe') byType.product += inv.totalValue;
    else byType.service += inv.totalValue;

    const month = inv.issuedAt.toISOString().slice(0, 7); // YYYY-MM
    monthMap.set(month, (monthMap.get(month) ?? 0) + inv.totalValue);
  }

  const perMonth = Array.from(monthMap.entries())
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return { totalSpent, invoiceCount, avgTicket, byType, perMonth };
}

export interface IInflationRow {
  itemId: string;
  name: string;
  referenceCode: string;
  type: 'product' | 'service';
  categoryName?: string;
  issuedAt: Date;
  unitValue: number; // centavos
}

export interface IInflationItem {
  itemId: string;
  name: string;
  referenceCode: string;
  type: 'product' | 'service';
  categoryName?: string;
  count: number;
  firstValue: number; // centavos
  lastValue: number; // centavos
  variationPct: number; // 0.15 = +15%
  history: Array<{ date: string; unitValue: number }>; // unitValue em centavos
}

export interface IInflation {
  index: number; // média ponderada das variações (0.1 = +10%)
  items: IInflationItem[];
}

/**
 * Calcula variação de preço por item (≥2 ocorrências) e o índice pessoal de inflação
 * (média das variações 1º→último ponderada pelo gasto no último preço).
 */
export function computeInflation(rows: IInflationRow[]): IInflation {
  const byItem = new Map<string, IInflationRow[]>();
  for (const row of rows) {
    const list = byItem.get(row.itemId) ?? [];
    list.push(row);
    byItem.set(row.itemId, list);
  }

  const items: IInflationItem[] = [];
  for (const [itemId, list] of byItem) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.issuedAt.getTime() - b.issuedAt.getTime());
    const firstValue = sorted[0].unitValue;
    const lastValue = sorted[sorted.length - 1].unitValue;
    const variationPct = firstValue === 0 ? 0 : (lastValue - firstValue) / firstValue;

    items.push({
      itemId,
      name: sorted[0].name,
      referenceCode: sorted[0].referenceCode,
      type: sorted[0].type,
      categoryName: sorted[0].categoryName,
      count: sorted.length,
      firstValue,
      lastValue,
      variationPct,
      history: sorted.map((r) => ({
        date: r.issuedAt.toISOString().slice(0, 10),
        unitValue: r.unitValue,
      })),
    });
  }

  items.sort((a, b) => Math.abs(b.variationPct) - Math.abs(a.variationPct));

  const weightTotal = items.reduce((acc, i) => acc + i.lastValue, 0);
  const index =
    weightTotal === 0
      ? 0
      : items.reduce((acc, i) => acc + i.variationPct * i.lastValue, 0) / weightTotal;

  return { index, items };
}

// IPCA / comparação ---------------------------------------------------------

export interface IIpcaSeriesPoint {
  month: string;
  pct: number; // variação mensal em %
}

/** Acumula variações mensais (%) num fator composto. 0.1 = +10%. */
export function accumulateIpca(series: IIpcaSeriesPoint[]): number {
  return series.reduce((acc, p) => acc * (1 + p.pct / 100), 1) - 1;
}

export interface IIpcaComparison {
  personal: number; // 0.2 = +20%
  ipca: number;
  diffPp: number; // diferença em pontos percentuais (já *100)
}

export function comparePersonalVsIpca(
  personalIndex: number,
  ipca: IIpcaSeriesPoint[],
): IIpcaComparison {
  const ipcaAcc = accumulateIpca(ipca);
  return {
    personal: personalIndex,
    ipca: ipcaAcc,
    diffPp: (personalIndex - ipcaAcc) * 100,
  };
}

// Inflação por categoria ----------------------------------------------------

export interface ICategoryInflation {
  category: string;
  index: number;
  itemCount: number;
}

const NO_CATEGORY = 'Sem categoria';

export function groupInflationByCategory(items: IInflationItem[]): ICategoryInflation[] {
  const byCat = new Map<string, IInflationItem[]>();
  for (const item of items) {
    const key = item.categoryName ?? NO_CATEGORY;
    const list = byCat.get(key) ?? [];
    list.push(item);
    byCat.set(key, list);
  }

  const result: ICategoryInflation[] = [];
  for (const [category, list] of byCat) {
    const weightTotal = list.reduce((acc, i) => acc + i.lastValue, 0);
    const index =
      weightTotal === 0
        ? 0
        : list.reduce((acc, i) => acc + i.variationPct * i.lastValue, 0) / weightTotal;
    result.push({ category, index, itemCount: list.length });
  }

  return result.sort((a, b) => b.index - a.index);
}
