import { StatusCodes } from 'http-status-codes';
import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '~/lib/auth/current-user';
import { errorResponse, parseBody, safeRoute } from '~/lib/http';
import { buildMeta, getPaginationParams } from '~/lib/pagination';
import prisma from '~/lib/prisma';
import { itemSchema } from '~/schemas/item';
import { createItem } from '~/services/management';

export const runtime = 'nodejs';

const P2002 = 'P2002';
const SORTABLE = new Set(['name', 'reference_code', 'type', 'created_at', 'updated_at']);
const TYPES = new Set(['product', 'service']);

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

  const [rows, total] = await Promise.all([
    prisma.item.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { invoice_items: true } },
      },
      orderBy: { [sortField]: order },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.item.count({ where }),
  ]);

  const data = rows.map((r) => ({
    id: r.id,
    type: r.type,
    reference_code: r.reference_code,
    name: r.name,
    unit: r.unit,
    nbs_code: r.nbs_code,
    category_id: r.category_id,
    category: r.category,
    usage_count: r._count.invoice_items,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

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
    const item = await createItem(parsed.data);
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
