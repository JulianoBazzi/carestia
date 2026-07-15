import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '~/lib/auth/current-user';
import { errorResponse, parseBody } from '~/lib/http';
import { itemAliasSchema } from '~/schemas/item';
import { createItemAlias, listItemAliases } from '~/services/management';

export const runtime = 'nodejs';

const P2002 = 'P2002';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Acesso negado.' }, { status: StatusCodes.FORBIDDEN });
  }

  const { id } = await params;
  try {
    const data = await listItemAliases(id);
    return NextResponse.json({ data }, { status: StatusCodes.OK });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Acesso negado.' }, { status: StatusCodes.FORBIDDEN });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(itemAliasSchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.error }, { status: StatusCodes.BAD_REQUEST });
  }

  try {
    const alias = await createItemAlias(id, parsed.data.name, parsed.data.reference_code);
    return NextResponse.json({ data: alias }, { status: StatusCodes.CREATED });
  } catch (e) {
    if (
      typeof e === 'object' &&
      e !== null &&
      'code' in e &&
      (e as { code: string }).code === P2002
    ) {
      return NextResponse.json(
        { message: 'Este nome alternativo já está em uso.' },
        { status: StatusCodes.CONFLICT },
      );
    }
    return errorResponse(e);
  }
}
