import { StatusCodes } from 'http-status-codes';
import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '~/lib/auth/current-user';
import { parseBody, safeRoute } from '~/lib/http';
import { buildMeta, getPaginationParams } from '~/lib/pagination';
import prisma from '~/lib/prisma';
import { companySchema } from '~/schemas/company';
import { createCompany, type ICompanyCreate } from '~/services/management';

export const runtime = 'nodejs';

const P2002 = 'P2002';
const SORTABLE = new Set(['social_name', 'fantasy_name', 'city', 'created_at', 'updated_at']);

export const GET = safeRoute(async (req: NextRequest) => {
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
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(companySchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.error }, { status: StatusCodes.BAD_REQUEST });
  }

  try {
    const company = await createCompany(parsed.data as unknown as ICompanyCreate);
    return NextResponse.json({ data: company }, { status: StatusCodes.CREATED });
  } catch (e) {
    if (
      typeof e === 'object' &&
      e !== null &&
      'code' in e &&
      (e as { code: string }).code === P2002
    ) {
      return NextResponse.json(
        { message: 'Já existe uma empresa com este CNPJ.' },
        { status: StatusCodes.CONFLICT },
      );
    }
    return NextResponse.json(
      { message: (e as Error).message },
      { status: StatusCodes.BAD_REQUEST },
    );
  }
}
