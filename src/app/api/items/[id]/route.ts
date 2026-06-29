import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { getSession } from '~/lib/auth/current-user';
import { setItemCategory } from '~/services/management';

export const runtime = 'nodejs';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const categoryId =
    typeof body.category_id === 'string' && body.category_id ? body.category_id : null;

  const count = await setItemCategory(id, categoryId);
  if (count === 0) {
    return NextResponse.json(
      { message: 'Item não encontrado.' },
      { status: StatusCodes.NOT_FOUND },
    );
  }
  return NextResponse.json({ data: { id } }, { status: StatusCodes.OK });
}
