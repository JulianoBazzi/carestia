import { NextResponse } from 'next/server';
import { getSession } from '~/lib/auth/current-user';
import { setItemCategory } from '~/services/management';

export const runtime = 'nodejs';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const categoryId =
    typeof body.category_id === 'string' && body.category_id ? body.category_id : null;

  const count = await setItemCategory(id, categoryId);
  if (count === 0) {
    return NextResponse.json({ error: 'Item não encontrado.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
