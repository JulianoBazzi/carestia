import 'server-only';
import { eanCandidates, normalizeEan } from '~/lib/ean';
import { monthKey } from '~/lib/format';
import { normalizeName } from '~/lib/normalize';
import prisma from '~/lib/prisma';

/**
 * Índice público regional de preços (anonimizado). Agrega o PREÇO UNITÁRIO médio
 * por item (incluindo energia em R$/kWh) a partir de DUAS fontes:
 *   - `invoice_items` (notas fiscais importadas);
 *   - `price_observations` (etiquetas de gôndola lidas no scanner e encartes
 *     lidos pelo admin — `source = 'flyer'`, preço de oferta, contado em
 *     `offerSamples` para a UI avisar).
 * Privacy-first: só usamos preço unitário + cidade/UF; nunca usuário, nota ou
 * dados pessoais — `user_id` não é lido em nenhuma das duas queries.
 *
 * Não há piso mínimo de amostras ou de usuários distintos: o índice publica todo
 * item que apareça em alguma nota/etiqueta. A diluição vem do volume — conforme a
 * base cresce, cada média passa a cobrir naturalmente muitas compras e contas.
 */

export interface IPublicPriceSeriesPoint {
  month: string; // "YYYY-MM"
  value: number; // média do mês, em reais
}

export interface IPublicPrice {
  itemId: string;
  name: string;
  type: 'product' | 'service' | 'energy';
  unit: string | null;
  avgPrice: number; // reais
  samples: number;
  /** Quantas das amostras vieram de encarte (preço de oferta). */
  offerSamples: number;
  series: IPublicPriceSeriesPoint[]; // média mensal recente (mini gráfico)
}

export interface IPublicPricesResult {
  prices: IPublicPrice[];
  states: string[];
}

/** Agregado de um recorte regional (cidade / UF / Brasil) para um EAN. */
export interface ITier {
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  samples: number;
  /** Quantas das amostras vieram de encarte (preço de oferta). */
  offerSamples: number;
  lastSeenAt: string; // ISO da amostra mais recente
  series: IPublicPriceSeriesPoint[];
}

export interface IEanPriceItem {
  id: string;
  name: string;
  unit: string | null;
  type: 'product';
  category: { name: string; slug: string; icon: string | null; color: string | null } | null;
}

export interface IEanPriceResult {
  ean: string;
  /** `null` quando o EAN ainda não está no catálogo. */
  item: IEanPriceItem | null;
  /** `null` quando não há item; cada recorte é `null` quando não tem amostra. */
  tiers: { city: ITier | null; state: ITier | null; country: ITier | null } | null;
  region: { city: string | null; state: string | null; ibge_code: string | null };
  sinceMonths: number;
}

export interface IEanRegion {
  ibgeCode?: string;
  city?: string;
  state?: string;
}

/** Uma amostra de preço, já sem qualquer vínculo com usuário. */
interface IPricePoint {
  itemId: string;
  name: string;
  type: IPublicPrice['type'];
  unit: string | null;
  date: Date;
  value: number;
  state: string | null;
  city: string | null;
  ibgeCode: string | null;
  /** Amostra de encarte (preço de oferta). */
  offer: boolean;
}

/** Fonte das observações lidas de encarte (ver `createFlyerObservations`). */
const FLYER_SOURCE = 'flyer';

interface IPointFilter {
  state?: string;
  city?: string;
  search?: string;
  /** Só amostras a partir desta data: a média de "hoje" não mistura anos. */
  since: Date;
}

/**
 * Janela do índice geral. A série exibe os últimos 8 meses; a média usa 12 —
 * incluir anos anteriores puxaria a média para preços de antes da inflação.
 */
const PUBLIC_WINDOW_MONTHS = 12;

function itemWhere(search?: string) {
  return {
    deleted_at: null,
    ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
  };
}

function regionWhere(filter: IPointFilter) {
  return {
    ...(filter.state ? { state: filter.state } : {}),
    ...(filter.city ? { city: { contains: filter.city, mode: 'insensitive' as const } } : {}),
  };
}

async function loadInvoicePoints(filter: IPointFilter): Promise<IPricePoint[]> {
  const rows = await prisma.invoiceItem.findMany({
    where: {
      // Exclui itens soft-deletados (ex.: mesclados) do índice público.
      // Preço zero/negativo não é compra comparável (defesa: a importação já descarta).
      unit_value: { gt: 0 },
      item: itemWhere(filter.search),
      invoice: { deleted_at: null, issued_at: { gte: filter.since }, ...regionWhere(filter) },
    },
    select: {
      unit_value: true,
      unit: true,
      item: { select: { id: true, name: true, type: true } },
      // `user_id` não entra no select: a agregação não precisa saber de quem é a nota.
      invoice: { select: { issued_at: true, state: true, city: true, ibge_code: true } },
    },
  });
  return rows.map((r) => ({
    itemId: r.item.id,
    name: r.item.name,
    type: r.item.type,
    unit: r.unit,
    date: r.invoice.issued_at,
    value: Number(r.unit_value),
    state: r.invoice.state,
    city: r.invoice.city,
    ibgeCode: r.invoice.ibge_code,
    offer: false,
  }));
}

async function loadObservationPoints(filter: IPointFilter): Promise<IPricePoint[]> {
  const rows = await prisma.priceObservation.findMany({
    where: {
      deleted_at: null,
      unit_value: { gt: 0 },
      observed_at: { gte: filter.since },
      item: itemWhere(filter.search),
      ...regionWhere(filter),
    },
    select: {
      unit_value: true,
      unit: true,
      observed_at: true,
      state: true,
      city: true,
      ibge_code: true,
      source: true,
      // Idem: `user_id` fica de fora.
      item: { select: { id: true, name: true, type: true } },
    },
  });
  return rows.map((r) => ({
    itemId: r.item.id,
    name: r.item.name,
    type: r.item.type,
    unit: r.unit,
    date: r.observed_at,
    value: Number(r.unit_value),
    state: r.state,
    city: r.city,
    ibgeCode: r.ibge_code,
    offer: r.source === FLYER_SOURCE,
  }));
}

function monthOf(date: Date): string {
  return monthKey(date);
}

/** Média mensal dos últimos 8 meses com amostra, em ordem cronológica. */
function buildSeries(points: IPricePoint[]): IPublicPriceSeriesPoint[] {
  const monthMap = new Map<string, { sum: number; n: number }>();
  for (const p of points) {
    const key = monthOf(p.date);
    const m = monthMap.get(key) ?? { sum: 0, n: 0 };
    m.sum += p.value;
    m.n += 1;
    monthMap.set(key, m);
  }
  return Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8)
    .map(([month, v]) => ({ month, value: v.sum / v.n }));
}

function countOffers(points: IPricePoint[]): number {
  return points.reduce((n, p) => n + (p.offer ? 1 : 0), 0);
}

function aggregate(points: IPricePoint[]): ITier | null {
  if (points.length === 0) {
    return null;
  }
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let last = points[0].date;
  for (const p of points) {
    sum += p.value;
    if (p.value < min) {
      min = p.value;
    }
    if (p.value > max) {
      max = p.value;
    }
    if (p.date > last) {
      last = p.date;
    }
  }
  return {
    avgPrice: sum / points.length,
    minPrice: min,
    maxPrice: max,
    samples: points.length,
    offerSamples: countOffers(points),
    lastSeenAt: last.toISOString(),
    series: buildSeries(points),
  };
}

export async function getPublicPrices(opts: {
  state?: string;
  city?: string;
  search?: string;
  limit?: number;
}): Promise<IPublicPricesResult> {
  const { state, city, search, limit = 12 } = opts;
  const filter = { state, city, search, since: monthsAgo(PUBLIC_WINDOW_MONTHS) };

  const [invoicePoints, observationPoints] = await Promise.all([
    loadInvoicePoints(filter),
    loadObservationPoints(filter),
  ]);
  const points = invoicePoints.concat(observationPoints);

  const states = new Set<string>();
  const byItem = new Map<
    string,
    { name: string; type: IPublicPrice['type']; unit: string | null; points: IPricePoint[] }
  >();

  for (const p of points) {
    if (p.state) {
      states.add(p.state);
    }
    const entry = byItem.get(p.itemId) ?? { name: p.name, type: p.type, unit: p.unit, points: [] };
    entry.points.push(p);
    byItem.set(p.itemId, entry);
  }

  const prices: IPublicPrice[] = [];
  for (const [itemId, e] of byItem) {
    const avgPrice = e.points.reduce((a, p) => a + p.value, 0) / e.points.length;
    prices.push({
      itemId,
      name: e.name,
      type: e.type,
      unit: e.unit,
      avgPrice,
      samples: e.points.length,
      offerSamples: countOffers(e.points),
      series: buildSeries(e.points),
    });
  }

  prices.sort((a, b) => b.samples - a.samples);

  return { prices: prices.slice(0, limit), states: Array.from(states).sort() };
}

/** Primeiro dia do mês, `months` meses atrás (UTC). */
function monthsAgo(months: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, 1));
}

/**
 * Preço de um produto pelo código de barras, em três recortes: cidade do
 * usuário, UF e Brasil. Considera só amostras recentes (`sinceMonths`), porque
 * o objetivo é "quanto custa hoje", não a série histórica.
 *
 * O recorte de cidade casa por código IBGE quando as duas pontas o têm; como o
 * IBGE só vem no XML da NF-e, o caminho principal é nome da cidade + UF, com a
 * mesma normalização usada na gravação (`normalizeName`).
 */
export async function getPublicPriceByEan(
  ean: string,
  region: IEanRegion = {},
  opts: { sinceMonths?: number } = {},
): Promise<IEanPriceResult> {
  const sinceMonths = opts.sinceMonths ?? 12;
  const normalizedEan = normalizeEan(ean);
  const state = region.state ? region.state.toUpperCase() : null;
  const city = normalizeName(region.city) ?? null;
  const ibgeCode = region.ibgeCode ?? null;
  const out: IEanPriceResult = {
    ean: normalizedEan,
    item: null,
    tiers: null,
    region: { city, state, ibge_code: ibgeCode },
    sinceMonths,
  };

  const candidates = eanCandidates(normalizedEan);
  if (candidates.length === 0) {
    return out;
  }

  const items = await prisma.item.findMany({
    where: { type: 'product', ean: { in: candidates }, deleted_at: null },
    select: {
      id: true,
      name: true,
      unit: true,
      category: { select: { name: true, slug: true, icon: true, color: true } },
    },
  });
  if (items.length === 0) {
    return out;
  }

  const ids = items.map((i) => i.id);
  const since = monthsAgo(sinceMonths);

  const [invoiceRows, observationRows] = await Promise.all([
    prisma.invoiceItem.findMany({
      where: {
        item_id: { in: ids },
        unit_value: { gt: 0 },
        invoice: { deleted_at: null, issued_at: { gte: since } },
      },
      select: {
        unit_value: true,
        unit: true,
        item_id: true,
        // Sem `user_id`: o índice não sabe de quem é a nota.
        invoice: { select: { issued_at: true, state: true, city: true, ibge_code: true } },
      },
    }),
    prisma.priceObservation.findMany({
      where: {
        item_id: { in: ids },
        deleted_at: null,
        unit_value: { gt: 0 },
        observed_at: { gte: since },
      },
      select: {
        unit_value: true,
        unit: true,
        item_id: true,
        observed_at: true,
        state: true,
        city: true,
        ibge_code: true,
        source: true,
      },
    }),
  ]);

  const points: IPricePoint[] = [
    ...invoiceRows.map((r) => ({
      itemId: r.item_id,
      name: '',
      type: 'product' as const,
      unit: r.unit,
      date: r.invoice.issued_at,
      value: Number(r.unit_value),
      state: r.invoice.state,
      city: r.invoice.city,
      ibgeCode: r.invoice.ibge_code,
      offer: false,
    })),
    ...observationRows.map((r) => ({
      itemId: r.item_id,
      name: '',
      type: 'product' as const,
      unit: r.unit,
      date: r.observed_at,
      value: Number(r.unit_value),
      state: r.state,
      city: r.city,
      ibgeCode: r.ibge_code,
      offer: r.source === FLYER_SOURCE,
    })),
  ];

  // Item "principal": o que tem mais amostras (empate → primeiro do banco).
  const countByItem = new Map<string, number>();
  for (const p of points) {
    countByItem.set(p.itemId, (countByItem.get(p.itemId) ?? 0) + 1);
  }
  const main = items.reduce((best, i) =>
    (countByItem.get(i.id) ?? 0) > (countByItem.get(best.id) ?? 0) ? i : best,
  );
  out.item = {
    id: main.id,
    name: main.name,
    unit: main.unit,
    type: 'product',
    category: main.category,
  };

  const inState = state ? points.filter((p) => p.state === state) : [];
  const inCity =
    state && (city || ibgeCode)
      ? points.filter(
          (p) =>
            // IBGE só vale junto com a UF: um código gravado errado não pode
            // levar a amostra para a cidade de outro estado.
            (ibgeCode !== null && p.ibgeCode === ibgeCode && p.state === state) ||
            (city !== null && p.state === state && p.city === city),
        )
      : [];

  out.tiers = {
    city: state && (city || ibgeCode) ? aggregate(inCity) : null,
    state: state ? aggregate(inState) : null,
    country: aggregate(points),
  };
  return out;
}
