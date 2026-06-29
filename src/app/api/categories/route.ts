import { StatusCodes } from 'http-status-codes';
import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '~/lib/auth/current-user';
import { buildMeta, getPaginationParams } from '~/lib/pagination';
import prisma from '~/lib/prisma';
import { createCategory } from '~/services/management';

export const runtime = 'nodejs';

const P2002 = 'P2002';
const SORTABLE = new Set(['name', 'slug', 'created_at', 'updated_at']);

export async function GET(req: NextRequest) {
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

  const [data, total] = await Promise.all([
    prisma.category.findMany({
      where,
      orderBy: { [sortField]: order },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.category.count({ where }),
  ]);

  return NextResponse.json({ data, meta: buildMeta(page, limit, total) });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json(
      { message: 'Nome é obrigatório.' },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  try {
    const category = await createCategory(name);
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
