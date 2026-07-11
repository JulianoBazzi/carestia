import { StatusCodes } from 'http-status-codes';
import { type NextRequest, NextResponse } from 'next/server';
import { getSession, isAdmin } from '~/lib/auth/current-user';
import {
  deleteCompany,
  getCompany,
  type ICompanyUpdate,
  updateCompany,
} from '~/services/management';

export const runtime = 'nodejs';

const FIELDS: (keyof ICompanyUpdate)[] = [
  'social_name',
  'fantasy_name',
  'street',
  'number',
  'neighborhood',
  'city',
  'state',
  'zipcode',
];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  const { id } = await params;
  const company = await getCompany(id);
  if (!company) {
    return NextResponse.json(
      { message: 'Empresa não encontrada.' },
      { status: StatusCodes.NOT_FOUND },
    );
  }
  return NextResponse.json({ data: company });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const data: ICompanyUpdate = {};
  for (const field of FIELDS) {
    if (field in body) {
      const value = body[field];
      (data as Record<string, unknown>)[field] = value === '' ? null : value;
    }
  }
  if (!data.social_name) {
    return NextResponse.json(
      { message: 'Razão social é obrigatória.' },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  const count = await updateCompany(id, data);
  if (count === 0) {
    return NextResponse.json(
      { message: 'Empresa não encontrada.' },
      { status: StatusCodes.NOT_FOUND },
    );
  }
  return NextResponse.json({ data: { id } }, { status: StatusCodes.OK });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Acesso negado.' }, { status: StatusCodes.FORBIDDEN });
  }

  const { id } = await params;
  const count = await deleteCompany(id);
  if (count === 0) {
    return NextResponse.json(
      { message: 'Empresa não encontrada.' },
      { status: StatusCodes.NOT_FOUND },
    );
  }
  return NextResponse.json({ data: { id } }, { status: StatusCodes.OK });
}
