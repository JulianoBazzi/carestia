import { NextResponse } from 'next/server';
import { safeRoute } from '~/lib/http';
import { normalizeName } from '~/lib/normalize';
import { enforceRateLimit } from '~/lib/rate-limit';
import { cacheGetJson, cacheSetJson } from '~/lib/redis';
import { getPublicPrices, type IPublicPricesResult } from '~/services/public-prices';

export const runtime = 'nodejs';

/** A agregação percorre a janela inteira de amostras: resultado cacheado por filtro. */
const CACHE_TTL_SECONDS = 10 * 60;
/** Busca/cidade são texto livre: cortadas para a chave de cache não crescer sem limite. */
const MAX_FILTER_LENGTH = 80;

function param(searchParams: URLSearchParams, name: string): string | undefined {
  const v = searchParams.get(name)?.trim().slice(0, MAX_FILTER_LENGTH);
  return v || undefined;
}

// Endpoint público (sem autenticação) — índice regional anonimizado.
export const GET = safeRoute(async (req: Request) => {
  const limited = enforceRateLimit(req, 'public-prices', 60, 60_000);
  if (limited) {
    return limited;
  }

  const { searchParams } = new URL(req.url);
  const state = param(searchParams, 'state')?.toUpperCase();
  const city = param(searchParams, 'city');
  const search = param(searchParams, 'search');

  const cacheKey = `public-prices:${[state, normalizeName(city), normalizeName(search)]
    .map((v) => v ?? '')
    .join('|')}`;
  const cached = await cacheGetJson<IPublicPricesResult>(cacheKey);
  if (cached) {
    return NextResponse.json({ data: cached });
  }

  const result = await getPublicPrices({ state, city, search, limit: 12 });
  await cacheSetJson(cacheKey, result, CACHE_TTL_SECONDS);
  return NextResponse.json({ data: result });
});
