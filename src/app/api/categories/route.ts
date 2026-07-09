import { StatusCodes } from 'http-status-codes';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '~/lib/auth/current-user';
import { parseBody, safeRoute } from '~/lib/http';
import { buildMeta, getPaginationParams } from '~/lib/pagination';
import prisma from '~/lib/prisma';
import { categorySchema } from '~/schemas/category';
import { createCategory, getCategoryStats } from '~/services/management';

export const runtime = 'nodejs';

const P2002 = 'P2002';
const SORTABLE = new Set(['name', 'slug', 'created_at', 'updated_at']);
const categoryCreateSchema = categorySchema.extend({ active: z.boolean().default(true) });

export const GET = safeRoute(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  const { searchParams } = new URL(req.url);
  const { page, limit, orderBy, order } = getPaginationParams(searchParams);
  const search = searchParams.get('search') ?? '';
  const sortField = SORTABLE.has(orderBy) ? orderBy : 'created_at';

  const where = {
    deleted_at: null,
    ...(search && { name: { contains: search, mode: 'insensitive' as const } }),
  };

  const [rows, total, summary] = await Promise.all([
    prisma.category.findMany({
      where,
      orderBy: { [sortField]: order },
      skip: (page - 1) * limit,
      take: limit,
      include: { _count: { select: { items: true } } },
    }),
    prisma.category.count({ where }),
    getCategoryStats(),
  ]);

  const data = rows.map(({ _count, ...category }) => ({
    ...category,
    items_count: _count.items,
  }));

  return NextResponse.json({ data, meta: buildMeta(page, limit, total), summary });
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(categoryCreateSchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.error }, { status: StatusCodes.BAD_REQUEST });
  }

  try {
    const category = await createCategory(parsed.data.name, parsed.data.active);
    return NextResponse.json({ data: category }, { status: StatusCodes.CREATED });
  } catch (e) {
    if (
      typeof e === 'object' &&
      e !== null &&
      'code' in e &&
      (e as { code: string }).code === P2002
    ) {
      return NextResponse.json(
        { message: 'Categoria já existe.' },
        { status: StatusCodes.CONFLICT },
      );
    }
    return NextResponse.json(
      { message: (e as Error).message },
      { status: StatusCodes.BAD_REQUEST },
    );
  }
}
