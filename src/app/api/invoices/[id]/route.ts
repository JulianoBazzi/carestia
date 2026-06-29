import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { getSession } from '~/lib/auth/current-user';
import { softDeleteInvoice } from '~/services/invoice/queries';

export const runtime = 'nodejs';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  const { id } = await params;
  const count = await softDeleteInvoice(session.sub, id);
  if (count === 0) {
    return NextResponse.json({ error: 'Nota não encontrada.' }, { status: StatusCodes.NOT_FOUND });
  }

  return NextResponse.json({ ok: true }, { status: StatusCodes.OK });
}
