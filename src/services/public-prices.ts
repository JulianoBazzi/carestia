import 'server-only';
import prisma from '~/lib/prisma';

/**
 * Índice público regional de preços (anonimizado). Agrega o PREÇO UNITÁRIO médio
 * por item (incluindo energia em R$/kWh) a partir das notas, agrupado por região.
 * Privacy-first: só usamos preço unitário + cidade/UF; nunca usuário, nota ou
 * dados pessoais. Um mínimo de USUÁRIOS DISTINTOS evita expor compras individuais.
 */

// Mínimo de usuários DISTINTOS que devem contribuir para um item (ou para um mês
// da série) aparecer publicamente. Contar amostras (line-items) não bastava: um
// único usuário comprando o mesmo item 3× exporia os dados de uma só pessoa.
const MIN_CONTRIBUTORS = 3;

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
      // Exclui itens soft-deletados (ex.: mesclados) do índice público.
      item: {
        deleted_at: null,
        ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      },
      invoice: {
        deleted_at: null,
        ...(state ? { state } : {}),
        ...(city ? { city: { contains: city, mode: 'insensitive' as const } } : {}),
      },
    },
    select: {
      unit_value: true,
      unit: true,
      item: { select: { id: true, name: true, type: true } },
      // `user_id` fica só no servidor — usado apenas para contar contribuintes
      // distintos; nunca é exposto no resultado.
      invoice: { select: { issued_at: true, state: true, user_id: true } },
    },
  });

  const states = new Set<string>();
  const byItem = new Map<
    string,
    {
      name: string;
      type: IPublicPrice['type'];
      unit: string | null;
      points: { month: string; value: number; userId: string }[];
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
      userId: li.invoice.user_id,
    });
    byItem.set(li.item.id, entry);
  }

  const prices: IPublicPrice[] = [];
  for (const [itemId, e] of byItem) {
    // Piso por USUÁRIOS distintos, não por número de compras.
    const contributors = new Set(e.points.map((p) => p.userId)).size;
    if (contributors < MIN_CONTRIBUTORS) continue;
    const avgPrice = e.points.reduce((a, p) => a + p.value, 0) / e.points.length;

    const monthMap = new Map<string, { sum: number; n: number; users: Set<string> }>();
    for (const p of e.points) {
      const m = monthMap.get(p.month) ?? { sum: 0, n: 0, users: new Set<string>() };
      m.sum += p.value;
      m.n += 1;
      m.users.add(p.userId);
      monthMap.set(p.month, m);
    }
    // Cada mês da série só aparece se tiver ≥ MIN_CONTRIBUTORS usuários distintos —
    // senão exporia o preço de uma transação individual.
    const series = Array.from(monthMap.entries())
      .filter(([, v]) => v.users.size >= MIN_CONTRIBUTORS)
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
