import { StatusCodes } from 'http-status-codes';
import { type NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '~/generated/prisma/client';
import { getSession, isAdmin } from '~/lib/auth/current-user';
import { errorResponse, parseBody, safeRoute } from '~/lib/http';
import { buildMeta, getPaginationParams } from '~/lib/pagination';
import prisma from '~/lib/prisma';
import { itemSchema } from '~/schemas/item';
import { createItem } from '~/services/management';

export const runtime = 'nodejs';

const P2002 = 'P2002';
const SORTABLE = new Set([
  'name',
  'reference_code',
  'type',
  'unit',
  'category',
  'created_at',
  'updated_at',
]);
const TYPES = new Set(['product', 'service']);
// Janela do preço médio da listagem. 12 meses (e não 30 dias): a maior parte
// dos itens do catálogo não reaparece todo mês, e com uma janela curta a coluna
// fica vazia justamente nos itens que se quer comparar para mesclar.
const PRICE_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

export const GET = safeRoute(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  const { searchParams } = new URL(req.url);
  const { page, limit, orderBy, order } = getPaginationParams(searchParams);
  const search = searchParams.get('search') ?? '';
  const typeParam = searchParams.get('type') ?? '';
  const sortField = SORTABLE.has(orderBy) ? orderBy : 'name';

  const where = {
    deleted_at: null,
    ...(TYPES.has(typeParam) && { type: typeParam as 'product' | 'service' }),
    ...(search && { name: { contains: search, mode: 'insensitive' as const } }),
  };

  // `unit` é nullable: nulos por último para a lista não abrir com itens sem unidade.
  // `category` ordena pelo nome da relação (itens sem categoria ficam no fim do asc).
  let orderByClause: Prisma.ItemOrderByWithRelationInput = { [sortField]: order };
  if (sortField === 'unit') {
    orderByClause = { unit: { sort: order, nulls: 'last' } };
  } else if (sortField === 'category') {
    orderByClause = { category: { name: order } };
  }

  const [rows, total] = await Promise.all([
    prisma.item.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { invoice_items: true } },
      },
      orderBy: orderByClause,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.item.count({ where }),
  ]);

  // Preço médio por item — o sinal que diz se dois itens parecidos são mesmo o
  // mesmo produto (mesclagem). A janela é por `invoice.issued_at` (data
  // econômica): `invoice_items` não tem data própria. Média GLOBAL (todas as
  // notas), sem jamais ler nem filtrar por `user_id` — mesmo princípio de
  // `public-prices.ts`, que também agrega em JS. Busca só as linhas dos ids da
  // página para não varrer a tabela inteira.
  const ids = rows.map((r) => r.id);
  const points = ids.length
    ? await prisma.invoiceItem.findMany({
        where: {
          item_id: { in: ids },
          invoice: { deleted_at: null, issued_at: { gte: new Date(Date.now() - PRICE_WINDOW_MS) } },
        },
        select: { item_id: true, unit_value: true, invoice: { select: { issued_at: true } } },
      })
    : [];

  const priceByItem = new Map<string, { sum: number; count: number; last: Date }>();
  for (const point of points) {
    const current = priceByItem.get(point.item_id);
    const issuedAt = point.invoice.issued_at;
    if (!current) {
      priceByItem.set(point.item_id, { sum: Number(point.unit_value), count: 1, last: issuedAt });
      continue;
    }
    current.sum += Number(point.unit_value);
    current.count += 1;
    if (issuedAt > current.last) {
      current.last = issuedAt;
    }
  }

  const data = rows.map((r) => {
    const price = priceByItem.get(r.id);
    return {
      id: r.id,
      type: r.type,
      reference_code: r.reference_code,
      name: r.name,
      unit: r.unit,
      ean: r.ean,
      nbs_code: r.nbs_code,
      category_id: r.category_id,
      category: r.category,
      usage_count: r._count.invoice_items,
      avg_price: price ? price.sum / price.count : null,
      price_samples: price?.count ?? 0,
      last_price_at: price?.last ?? null,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  });

  return NextResponse.json({ data, meta: buildMeta(page, limit, total) });
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(itemSchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.error }, { status: StatusCodes.BAD_REQUEST });
  }

  try {
    // EAN só-admin (ver PATCH em items/[id]).
    const { ean, ...rest } = parsed.data;
    const item = await createItem(isAdmin(session) ? { ...rest, ean } : rest);
    return NextResponse.json({ data: item }, { status: StatusCodes.CREATED });
  } catch (e) {
    if (
      typeof e === 'object' &&
      e !== null &&
      'code' in e &&
      (e as { code: string }).code === P2002
    ) {
      return NextResponse.json(
        { message: 'Já existe um item com este tipo, código e nome.' },
        { status: StatusCodes.CONFLICT },
      );
    }
    return errorResponse(e);
  }
}
