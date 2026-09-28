import { StatusCodes } from 'http-status-codes';
import { type NextRequest, NextResponse } from 'next/server';
import { isValidGtin, normalizeEan } from '~/lib/ean';
import { parseBody, safeRoute } from '~/lib/http';
import { enforceRateLimit } from '~/lib/rate-limit';
import { eanLookupQuerySchema } from '~/schemas/public-prices';
import { getPublicPriceByEan } from '~/services/public-prices';

export const runtime = 'nodejs';

/**
 * Preço de um produto pelo código de barras nos recortes cidade/UF/Brasil.
 * Endpoint público (sem autenticação) — mesma base anonimizada do índice
 * regional. EAN desconhecido responde 200 com `item: null` (não é erro).
 */
export const GET = safeRoute(
  async (req: NextRequest, ctx: { params: Promise<{ ean: string }> }) => {
    const limited = enforceRateLimit(req, 'public-ean', 60, 60_000);
    if (limited) {
      return limited;
    }

    const { ean: rawEan } = await ctx.params;
    const ean = normalizeEan(rawEan);
    if (!isValidGtin(ean)) {
      const msg = 'Código de barras inválido.';
      return NextResponse.json({ error: msg, message: msg }, { status: StatusCodes.BAD_REQUEST });
    }

    const { searchParams } = req.nextUrl;
    const parsed = parseBody(eanLookupQuerySchema, {
      state: searchParams.get('state') || undefined,
      city: searchParams.get('city') || undefined,
      ibge_code: searchParams.get('ibge_code') || undefined,
    });
    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error, message: parsed.error },
        { status: StatusCodes.BAD_REQUEST },
      );
    }

    const { state, city, ibge_code } = parsed.data;
    const result = await getPublicPriceByEan(ean, { state, city, ibgeCode: ibge_code });
    return NextResponse.json({ data: result });
  },
);
