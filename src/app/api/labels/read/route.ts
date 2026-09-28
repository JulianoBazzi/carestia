import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '~/lib/auth/current-user';
import { parseBody, safeRoute } from '~/lib/http';
import {
  checkRateLimit,
  DAY_MS,
  enforceRateLimit,
  rateLimitResponse,
  refundRateLimit,
} from '~/lib/rate-limit';
import { labelReadSchema } from '~/schemas/label';
import { isAiEnabled, readPriceLabel } from '~/services/openai';

export const runtime = 'nodejs';

/** Cota diária de leituras por usuário (admin isento). */
const USER_DAILY_LIMIT = 30;
/** Teto diário somando todos os usuários — trava de custo da API paga. */
const GLOBAL_DAILY_LIMIT = 500;
/** A foto chega reduzida (≤1280 px JPEG) em base64: bem abaixo disso. */
const MAX_BODY_BYTES = 3 * 1024 * 1024;
const GLOBAL_KEY = 'labels-read:global';

function fail(message: string, status: number) {
  return NextResponse.json({ error: message, message }, { status });
}

/**
 * Lê a foto de uma etiqueta de gôndola (EAN, preço, nome, unidade) via OpenAI.
 * Qualquer usuário logado, com cota. A imagem não é armazenada.
 */
export const POST = safeRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) {
    return fail('Não autenticado.', StatusCodes.UNAUTHORIZED);
  }
  if (!isAiEnabled()) {
    return fail(
      'Leitura de etiqueta indisponível (OPENAI_API_KEY não configurado).',
      StatusCodes.SERVICE_UNAVAILABLE,
    );
  }

  // Recusa pelo header antes de bufferizar/parsear um JSON enorme.
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return fail('Imagem grande demais.', StatusCodes.REQUEST_TOO_LONG);
  }

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(labelReadSchema, body);
  if (!parsed.ok) {
    return fail(parsed.error, StatusCodes.BAD_REQUEST);
  }

  // Teto global primeiro: se ele recusar, a cota do usuário não é debitada. Se
  // a do usuário recusar, a unidade global volta.
  const admin = isAdmin(session);
  if (!admin) {
    const global = checkRateLimit(GLOBAL_KEY, GLOBAL_DAILY_LIMIT, DAY_MS);
    if (!global.ok) {
      return rateLimitResponse(global.retryAfter);
    }
  }
  const limited = enforceRateLimit(req, 'labels-read', USER_DAILY_LIMIT, DAY_MS, session, {
    by: 'user',
  });
  if (limited) {
    if (!admin) {
      refundRateLimit(GLOBAL_KEY);
    }
    return limited;
  }

  const reading = await readPriceLabel(parsed.data.image);
  if (!reading) {
    return fail('Não foi possível ler a etiqueta. Tente outra foto.', StatusCodes.BAD_GATEWAY);
  }

  return NextResponse.json({ data: reading });
});
