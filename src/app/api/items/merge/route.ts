import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '~/lib/auth/current-user';
import { parseBody } from '~/lib/http';
import { zulid } from '~/schemas/lib';
import { mergeItems } from '~/services/management';

export const runtime = 'nodejs';

const mergeSchema = z.object({ sourceId: zulid(), targetId: zulid() });

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
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
    return NextResponse.json(
      { message: (e as Error).message },
      { status: StatusCodes.BAD_REQUEST },
    );
  }
  return NextResponse.json({ data: { sourceId, targetId } }, { status: StatusCodes.OK });
}
