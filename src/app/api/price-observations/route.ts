import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { getSession } from '~/lib/auth/current-user';
import { parseBody, safeRoute } from '~/lib/http';
import { DAY_MS, enforceRateLimit } from '~/lib/rate-limit';
import { priceObservationSchema } from '~/schemas/price-observation';
import { createPriceObservation } from '~/services/price-observations';
import { getPublicPriceByEan } from '~/services/public-prices';

export const runtime = 'nodejs';

/** Cota diária por usuário de observações de preço (admin isento). */
const DAILY_LIMIT = 50;

/**
 * Registra o preço lido de uma etiqueta de gôndola. Qualquer usuário logado.
 * Responde com os recortes de preço já atualizados para a UI comparar.
 */
export const POST = safeRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) {
    const msg = 'Não autenticado.';
    return NextResponse.json({ error: msg, message: msg }, { status: StatusCodes.UNAUTHORIZED });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(priceObservationSchema, body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error, message: parsed.error },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  const limited = enforceRateLimit(req, 'price-observations', DAILY_LIMIT, DAY_MS, session, {
    by: 'user',
  });
  if (limited) {
    return limited;
  }

  const { id } = await createPriceObservation(session.sub, parsed.data);
  const prices = await getPublicPriceByEan(parsed.data.ean, {
    city: parsed.data.city,
    state: parsed.data.state,
    ibgeCode: parsed.data.ibge_code,
  });

  return NextResponse.json({ data: { id, prices } }, { status: StatusCodes.CREATED });
});
