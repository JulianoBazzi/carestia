import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '~/lib/auth/current-user';
import { errorResponse, parseBody } from '~/lib/http';
import { itemSchema } from '~/schemas/item';
import { ignoreItem, setItemCategory, updateItem } from '~/services/management';

export const runtime = 'nodejs';

const P2002 = 'P2002';

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
      // Mesma validação do POST (`itemSchema`), inclusive a trava de produto.
      const parsed = parseBody(itemSchema, body);
      if (!parsed.ok) {
        return NextResponse.json({ message: parsed.error }, { status: StatusCodes.BAD_REQUEST });
      }
      // `type` sai fora de propósito: edição não converte o tipo de um item já
      // existente (itens de serviço legados continuam serviço).
      // O EAN é só-admin: o lookup público por código de barras e o atalho da
      // importação confiam nele — apontar um item para o EAN de um produto
      // popular sequestraria o preço exibido no scanner. Para os demais, o
      // campo é ignorado (fica como está).
      const { type: _type, ean, ...rest } = parsed.data;
      count = await updateItem(id, isAdmin(session) ? { ...rest, ean } : rest);
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
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Acesso negado.' }, { status: StatusCodes.FORBIDDEN });
  }

  const { id } = await params;
  const count = await ignoreItem(id);
  if (count === 0) {
    return NextResponse.json(
      { message: 'Item não encontrado.' },
      { status: StatusCodes.NOT_FOUND },
    );
  }
  return NextResponse.json({ data: { id } }, { status: StatusCodes.OK });
}
