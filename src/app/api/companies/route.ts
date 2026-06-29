import { StatusCodes } from 'http-status-codes';
import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '~/lib/auth/current-user';
import { buildMeta, getPaginationParams } from '~/lib/pagination';
import prisma from '~/lib/prisma';

export const runtime = 'nodejs';

const SORTABLE = new Set(['social_name', 'fantasy_name', 'city', 'created_at', 'updated_at']);

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  const { searchParams } = new URL(req.url);
  const { page, limit, orderBy, order } = getPaginationParams(searchParams);
  const search = searchParams.get('search') ?? '';
  const sortField = SORTABLE.has(orderBy) ? orderBy : 'social_name';

  const where = {
    deleted_at: null,
    ...(search && {
      OR: [
        { social_name: { contains: search, mode: 'insensitive' as const } },
        { fantasy_name: { contains: search, mode: 'insensitive' as const } },
        { document: { contains: search } },
      ],
    }),
  };

  const [data, total] = await Promise.all([
    prisma.company.findMany({
      where,
      orderBy: { [sortField]: order },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.company.count({ where }),
  ]);

  return NextResponse.json({ data, meta: buildMeta(page, limit, total) });
}
