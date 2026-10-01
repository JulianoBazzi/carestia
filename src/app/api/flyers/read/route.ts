import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '~/lib/auth/current-user';
import { mapPool } from '~/lib/concurrency';
import { toDateInputValue } from '~/lib/format';
import { findMunicipioByName } from '~/lib/geo/municipios';
import { parseBody, safeRoute } from '~/lib/http';
import prisma from '~/lib/prisma';
import { flyerReadSchema } from '~/schemas/flyer';
import { NO_REFERENCE_SIMILARITY_THRESHOLD, suggestItems } from '~/services/invoice/item-matching';
import { isAiEnabled, readFlyer } from '~/services/openai';

export const runtime = 'nodejs';
/** A leitura de um encarte denso leva dezenas de segundos. */
export const maxDuration = 120;

/** Encarte reduzido (≤2048 px JPEG) em base64: bem abaixo disso. */
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const SUGGEST_CONCURRENCY = 4;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message, message }, { status });
}

/**
 * Lê um encarte/panfleto (vários produtos) via OpenAI e anexa a cada item as
 * sugestões do catálogo para a revisão. Só-admin. A imagem não é armazenada.
 */
export const POST = safeRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) {
    return fail('Não autenticado.', StatusCodes.UNAUTHORIZED);
  }
  if (!isAdmin(session)) {
    return fail('Acesso restrito ao administrador.', StatusCodes.FORBIDDEN);
  }
  if (!isAiEnabled()) {
    return fail(
      'Leitura de encarte indisponível (OPENAI_API_KEY não configurado).',
      StatusCodes.SERVICE_UNAVAILABLE,
    );
  }

  // Recusa pelo header antes de bufferizar/parsear um JSON enorme.
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return fail('Imagem grande demais.', StatusCodes.REQUEST_TOO_LONG);
  }

  const body = await req.json().catch(() => ({}));
  const parsed = parseBody(flyerReadSchema, body);
  if (!parsed.ok) {
    return fail(parsed.error, StatusCodes.BAD_REQUEST);
  }

  const reading = await readFlyer(parsed.data.image, toDateInputValue(new Date()));
  if (!reading) {
    return fail('Não foi possível ler o encarte. Tente outra imagem.', StatusCodes.BAD_GATEWAY);
  }

  // Só cidades que existem na UF lida — o resto o admin digita na revisão.
  const cities = reading.state
    ? reading.cities.flatMap((c) => {
        const m = findMunicipioByName(reading.state as string, c);
        return m ? [m.name] : [];
      })
    : [];

  // Cada sugestão é uma varredura por trigram no catálogo: poucas em paralelo
  // para não ocupar o pool inteiro.
  const items = await mapPool(reading.items, SUGGEST_CONCURRENCY, async (item) => {
    const suggestions = await suggestItems(prisma, item.name, { limit: 3 });
    // Pré-seleção só com nome quase idêntico E mesmo tamanho de embalagem
    // (mesma régua do matching sem NCM); o admin confere de qualquer forma.
    const best = suggestions[0];
    const match =
      best && best.similarity >= NO_REFERENCE_SIMILARITY_THRESHOLD && best.samePack
        ? best.id
        : null;
    return { ...item, suggestions, match_id: match };
  });

  return NextResponse.json({ data: { ...reading, cities, items } });
});
