import { NextResponse } from 'next/server';
import { safeRoute } from '~/lib/http';
import { getPublicPrices } from '~/services/public-prices';

export const runtime = 'nodejs';

// Endpoint público (sem autenticação) — índice regional anonimizado.
export const GET = safeRoute(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const result = await getPublicPrices({
    state: searchParams.get('state') || undefined,
    city: searchParams.get('city') || undefined,
    search: searchParams.get('search') || undefined,
    limit: 12,
  });
  return NextResponse.json({ data: result });
});
