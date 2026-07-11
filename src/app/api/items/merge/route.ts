import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, isAdmin } from '~/lib/auth/current-user';
import { errorResponse, parseBody } from '~/lib/http';
import { zulid } from '~/schemas/lib';
import { mergeItems } from '~/services/management';

export const runtime = 'nodejs';

const mergeSchema = z.object({ sourceId: zulid(), targetId: zulid() });

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Acesso negado.' }, { status: StatusCodes.FORBIDDEN });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(mergeSchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.error }, { status: StatusCodes.BAD_REQUEST });
  }
  const { sourceId, targetId } = parsed.data;

  try {
    await mergeItems(sourceId, targetId);
  } catch (e) {
    return errorResponse(e);
  }
  return NextResponse.json({ data: { sourceId, targetId } }, { status: StatusCodes.OK });
}
