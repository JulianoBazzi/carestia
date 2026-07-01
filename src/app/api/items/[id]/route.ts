import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { getSession } from '~/lib/auth/current-user';
import { deleteItem, type IItemInput, setItemCategory, updateItem } from '~/services/management';

export const runtime = 'nodejs';

const P2002 = 'P2002';
const TYPES = new Set(['product', 'service']);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  // Edição completa (modal) vs. reatribuição rápida de categoria (select inline).
  const isFullUpdate = typeof body.name === 'string';

  try {
    let count: number;
    if (isFullUpdate) {
      const type = TYPES.has(body.type) ? (body.type as 'product' | 'service') : null;
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const reference_code =
        typeof body.reference_code === 'string' ? body.reference_code.trim() : '';
      if (!type || !name || !reference_code) {
        return NextResponse.json(
          { message: 'Tipo, nome e código são obrigatórios.' },
          { status: StatusCodes.BAD_REQUEST },
        );
      }
      const data: IItemInput = {
        type,
        name,
        reference_code,
        category_id:
          typeof body.category_id === 'string' && body.category_id ? body.category_id : null,
        ...(typeof body.unit === 'string' && { unit: body.unit || null }),
      };
      count = await updateItem(id, data);
    } else {
      const categoryId =
        typeof body.category_id === 'string' && body.category_id ? body.category_id : null;
      count = await setItemCategory(id, categoryId);
    }

    if (count === 0) {
      return NextResponse.json(
        { message: 'Item não encontrado.' },
        { status: StatusCodes.NOT_FOUND },
      );
    }
    return NextResponse.json({ data: { id } }, { status: StatusCodes.OK });
  } catch (e) {
    if (
      typeof e === 'object' &&
      e !== null &&
      'code' in e &&
      (e as { code: string }).code === P2002
    ) {
      return NextResponse.json(
        { message: 'Já existe um item com este tipo, código e nome.' },
        { status: StatusCodes.CONFLICT },
      );
    }
    return NextResponse.json(
      { message: (e as Error).message },
      { status: StatusCodes.BAD_REQUEST },
    );
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  const { id } = await params;
  const count = await deleteItem(id);
  if (count === 0) {
    return NextResponse.json(
      { message: 'Item não encontrado.' },
      { status: StatusCodes.NOT_FOUND },
    );
  }
  return NextResponse.json({ data: { id } }, { status: StatusCodes.OK });
}
