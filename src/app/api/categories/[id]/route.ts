import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '~/lib/auth/current-user';
import { errorResponse, parseBody } from '~/lib/http';
import { categorySchema } from '~/schemas/category';
import { deleteCategory, updateCategory } from '~/services/management';

export const runtime = 'nodejs';

const P2002 = 'P2002';
// `active` é opcional na edição (a rota preserva o valor atual quando ausente);
// nome continua obrigatório.
const categoryUpdateSchema = categorySchema.partial({ active: true });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(categoryUpdateSchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.error }, { status: StatusCodes.BAD_REQUEST });
  }

  try {
    const count = await updateCategory(id, parsed.data);
    if (count === 0) {
      return NextResponse.json(
        { message: 'Categoria não encontrada.' },
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
        { message: 'Categoria já existe.' },
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
  const count = await deleteCategory(id);
  if (count === 0) {
    return NextResponse.json(
      { message: 'Categoria não encontrada.' },
      { status: StatusCodes.NOT_FOUND },
    );
  }
  return NextResponse.json({ data: { id } }, { status: StatusCodes.OK });
}
