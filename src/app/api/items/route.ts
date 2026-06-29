import { StatusCodes } from 'http-status-codes';
import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '~/lib/auth/current-user';
import { buildMeta, getPaginationParams } from '~/lib/pagination';
import prisma from '~/lib/prisma';

export const runtime = 'nodejs';

const SORTABLE = new Set(['name', 'reference_code', 'type', 'created_at', 'updated_at']);

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  const { searchParams } = new URL(req.url);
  const { page, limit, orderBy, order } = getPaginationParams(searchParams);
  const search = searchParams.get('search') ?? '';
  const sortField = SORTABLE.has(orderBy) ? orderBy : 'name';

  const where = {
    deleted_at: null,
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
}
