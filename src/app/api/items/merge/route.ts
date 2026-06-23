import { NextResponse } from 'next/server';
import { getSession } from '~/lib/auth/current-user';
import { mergeItems } from '~/services/management';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { sourceId, targetId } = body;
  if (!sourceId || !targetId) {
    return NextResponse.json({ error: 'sourceId e targetId são obrigatórios.' }, { status: 400 });
  }

  try {
    await mergeItems(sourceId, targetId);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
