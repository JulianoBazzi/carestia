import { NextResponse } from 'next/server';
import { getPublicPrices } from '~/services/public-prices';

export const runtime = 'nodejs';

// Endpoint público (sem autenticação) — índice regional anonimizado.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const result = await getPublicPrices({
    state: searchParams.get('state') || undefined,
    city: searchParams.get('city') || undefined,
    search: searchParams.get('search') || undefined,
    limit: 12,
  });
  return NextResponse.json({ data: result });
}
