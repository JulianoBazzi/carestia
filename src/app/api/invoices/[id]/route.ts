import { NextResponse } from 'next/server';
import { getSession } from '~/lib/auth/current-user';
import { softDeleteInvoice } from '~/services/invoice/queries';

export const runtime = 'nodejs';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const { id } = await params;
  const count = await softDeleteInvoice(session.sub, id);
  if (count === 0) {
    return NextResponse.json({ error: 'Nota não encontrada.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
