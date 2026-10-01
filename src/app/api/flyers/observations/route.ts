import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '~/lib/auth/current-user';
import { parseBody, safeRoute } from '~/lib/http';
import { flyerObservationsSchema } from '~/schemas/flyer';
import { createFlyerObservations } from '~/services/price-observations';

export const runtime = 'nodejs';

function fail(message: string, status: number) {
  return NextResponse.json({ error: message, message }, { status });
}

/**
 * Grava os itens revisados de um encarte como observações de preço
 * (`source = 'flyer'`). Só-admin. Responde quantas foram criadas e quantas já
 * existiam (mesmo item + preço + dia + região).
 */
export const POST = safeRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) {
    return fail('Não autenticado.', StatusCodes.UNAUTHORIZED);
  }
  if (!isAdmin(session)) {
    return fail('Acesso restrito ao administrador.', StatusCodes.FORBIDDEN);
  }

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(flyerObservationsSchema, body);
  if (!parsed.ok) {
    return fail(parsed.error, StatusCodes.BAD_REQUEST);
  }

  const result = await createFlyerObservations(session.sub, parsed.data);
  return NextResponse.json({ data: result }, { status: StatusCodes.CREATED });
});
