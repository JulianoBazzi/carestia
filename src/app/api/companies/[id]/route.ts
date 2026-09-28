import { StatusCodes } from 'http-status-codes';
import { type NextRequest, NextResponse } from 'next/server';
import { getSession, isAdmin } from '~/lib/auth/current-user';
import { parseBody, safeRoute } from '~/lib/http';
import { companyUpdateSchema } from '~/schemas/company';
import {
  deleteCompany,
  getCompany,
  type ICompanyUpdate,
  updateCompany,
} from '~/services/management';

export const runtime = 'nodejs';

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

export const PATCH = safeRoute(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { message: 'Não autenticado.' },
        { status: StatusCodes.UNAUTHORIZED },
      );
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = parseBody(companyUpdateSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ message: parsed.error }, { status: StatusCodes.BAD_REQUEST });
    }
    const { state, ...rest } = parsed.data;
    const data: ICompanyUpdate = {
      ...rest,
      ...(state !== undefined && { state: state ? state.toUpperCase() : null }),
    };

    const count = await updateCompany(id, data);
    if (count === 0) {
      return NextResponse.json(
        { message: 'Empresa não encontrada.' },
        { status: StatusCodes.NOT_FOUND },
      );
    }
    return NextResponse.json({ data: { id } }, { status: StatusCodes.OK });
  },
);

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
