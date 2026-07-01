// Funções puras de agregação (sem DB) — testáveis isoladamente.
// Privacy-first: trabalhamos só com PREÇO UNITÁRIO (R$), sem quantidades nem totais.

export type ItemKind = 'product' | 'service' | 'energy';

export interface IInflationRow {
  itemId: string;
  name: string;
  referenceCode: string;
  type: ItemKind;
  categoryName?: string;
  issuedAt: Date;
  unitValue: number; // reais (R$/un, R$/kWh)
}

export interface IInflationItem {
  itemId: string;
  name: string;
  referenceCode: string;
  type: ItemKind;
  categoryName?: string;
  count: number;
  firstValue: number; // reais
  lastValue: number; // reais
  variationPct: number; // 0.15 = +15%
  history: Array<{ date: string; unitValue: number }>; // unitValue em reais
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

export interface IInflationSeriesPoint {
  month: string; // "YYYY-MM"
  personalPct: number; // acumulado, 0.1 = +10%
  ipcaPct: number; // acumulado, 0.1 = +10%
}

/** Lista de meses "YYYY-MM" do menor ao maior `issuedAt`. */
function monthRange(rows: IInflationRow[]): string[] {
  const months = rows.map((r) => r.issuedAt.toISOString().slice(0, 7)).sort();
  const first = months[0];
  const last = months[months.length - 1];
  const out: string[] = [];
  let [y, m] = first.split('-').map(Number);
  while (true) {
    const cur = `${y}-${String(m).padStart(2, '0')}`;
    out.push(cur);
    if (cur === last) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/**
 * Série mensal acumulada da inflação pessoal × IPCA, para o gráfico do dashboard.
 * Em cada mês, a inflação pessoal é recalculada considerando o primeiro preço de
 * cada item × o último preço até aquele mês (ponderada pelo último preço).
 */
export function computeMonthlyInflationSeries(
  rows: IInflationRow[],
  ipca: IIpcaSeriesPoint[],
): IInflationSeriesPoint[] {
  if (rows.length === 0) return [];

  const byItem = new Map<string, IInflationRow[]>();
  for (const r of rows) {
    const list = byItem.get(r.itemId) ?? [];
    list.push(r);
    byItem.set(r.itemId, list);
  }
  for (const [, list] of byItem) {
    list.sort((a, b) => a.issuedAt.getTime() - b.issuedAt.getTime());
  }

  const ipcaByMonth = new Map<string, number>();
  let ipcaAcc = 1;
  for (const p of [...ipca].sort((a, b) => a.month.localeCompare(b.month))) {
    ipcaAcc *= 1 + p.pct / 100;
    ipcaByMonth.set(p.month, ipcaAcc - 1);
  }

  const out: IInflationSeriesPoint[] = [];
  let lastIpca = 0;
  for (const month of monthRange(rows)) {
    let weight = 0;
    let weighted = 0;
    for (const [, list] of byItem) {
      const upto = list.filter((r) => r.issuedAt.toISOString().slice(0, 7) <= month);
      if (upto.length < 2) continue;
      const first = upto[0].unitValue;
      const last = upto[upto.length - 1].unitValue;
      if (first === 0) continue;
      weight += last;
      weighted += ((last - first) / first) * last;
    }
    if (ipcaByMonth.has(month)) lastIpca = ipcaByMonth.get(month) as number;
    out.push({ month, personalPct: weight === 0 ? 0 : weighted / weight, ipcaPct: lastIpca });
  }
  return out;
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
