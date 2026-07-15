import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '~/lib/auth/current-user';
import { errorResponse } from '~/lib/http';
import { deleteItemAlias } from '~/services/management';

export const runtime = 'nodejs';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; aliasId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Acesso negado.' }, { status: StatusCodes.FORBIDDEN });
  }

  const { id, aliasId } = await params;
  try {
    const count = await deleteItemAlias(id, aliasId);
    if (count === 0) {
      return NextResponse.json(
        { message: 'Nome alternativo não encontrado.' },
        { status: StatusCodes.NOT_FOUND },
      );
    }
    return NextResponse.json({ data: { id: aliasId } }, { status: StatusCodes.OK });
  } catch (e) {
    return errorResponse(e);
  }
}
