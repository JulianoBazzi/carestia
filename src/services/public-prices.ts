import 'server-only';
import prisma from '~/lib/prisma';

/**
 * Índice público regional de preços (anonimizado). Agrega o PREÇO UNITÁRIO médio
 * por item (incluindo energia em R$/kWh) a partir das notas, agrupado por região.
 * Privacy-first: só usamos preço unitário + cidade/UF; nunca usuário, nota ou
 * dados pessoais. Um mínimo de amostras evita expor compras individuais.
 */

const MIN_SAMPLES = 3;

export interface IPublicPrice {
  itemId: string;
  name: string;
  type: 'product' | 'service' | 'energy';
  unit: string | null;
  avgPrice: number; // reais
  samples: number;
  series: number[]; // média mensal recente (mini gráfico)
}

export interface IPublicPricesResult {
  prices: IPublicPrice[];
  states: string[];
}

export async function getPublicPrices(opts: {
  state?: string;
  city?: string;
  search?: string;
  limit?: number;
}): Promise<IPublicPricesResult> {
  const { state, city, search, limit = 12 } = opts;

  const lineItems = await prisma.invoiceItem.findMany({
    where: {
      invoice: {
        deleted_at: null,
        ...(state ? { state } : {}),
        ...(city ? { city: { contains: city, mode: 'insensitive' as const } } : {}),
      },
      ...(search ? { item: { name: { contains: search, mode: 'insensitive' as const } } } : {}),
    },
    select: {
      unit_value: true,
      unit: true,
      item: { select: { id: true, name: true, type: true } },
      invoice: { select: { issued_at: true, state: true } },
    },
  });

  const states = new Set<string>();
  const byItem = new Map<
    string,
    {
      name: string;
      type: IPublicPrice['type'];
      unit: string | null;
      points: { month: string; value: number }[];
    }
  >();

  for (const li of lineItems) {
    if (li.invoice.state) states.add(li.invoice.state);
    const entry = byItem.get(li.item.id) ?? {
      name: li.item.name,
      type: li.item.type,
      unit: li.unit,
      points: [],
    };
    entry.points.push({
      month: li.invoice.issued_at.toISOString().slice(0, 7),
      value: Number(li.unit_value),
    });
    byItem.set(li.item.id, entry);
  }

  const prices: IPublicPrice[] = [];
  for (const [itemId, e] of byItem) {
    if (e.points.length < MIN_SAMPLES) continue;
    const avgPrice = e.points.reduce((a, p) => a + p.value, 0) / e.points.length;

    const monthMap = new Map<string, { sum: number; n: number }>();
    for (const p of e.points) {
      const m = monthMap.get(p.month) ?? { sum: 0, n: 0 };
      m.sum += p.value;
      m.n += 1;
      monthMap.set(p.month, m);
    }
    const series = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-8)
      .map(([, v]) => v.sum / v.n);

    prices.push({
      itemId,
      name: e.name,
      type: e.type,
      unit: e.unit,
      avgPrice,
      samples: e.points.length,
      series,
    });
  }

  prices.sort((a, b) => b.samples - a.samples);

  return { prices: prices.slice(0, limit), states: Array.from(states).sort() };
}
