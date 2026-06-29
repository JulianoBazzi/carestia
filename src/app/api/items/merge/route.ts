import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { getSession } from '~/lib/auth/current-user';
import { mergeItems } from '~/services/management';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  const body = await req.json().catch(() => ({}));
  const { sourceId, targetId } = body;
  if (!sourceId || !targetId) {
    return NextResponse.json(
      { message: 'sourceId e targetId são obrigatórios.' },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  try {
    await mergeItems(sourceId, targetId);
  } catch (e) {
    return NextResponse.json(
      { message: (e as Error).message },
      { status: StatusCodes.BAD_REQUEST },
    );
  }
  return NextResponse.json({ data: { sourceId, targetId } }, { status: StatusCodes.OK });
}
