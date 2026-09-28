import { StatusCodes } from 'http-status-codes';
import { type NextRequest, NextResponse } from 'next/server';
import { isInBrazil, nearestMunicipio } from '~/lib/geo/municipios';
import { parseBody, safeRoute } from '~/lib/http';
import { enforceRateLimit } from '~/lib/rate-limit';
import { geoReverseSchema } from '~/schemas/geo';

export const runtime = 'nodejs';

/**
 * Coordenada → município (cidade/UF/IBGE) pelo centróide mais próximo, sem
 * geocoder externo. Pública (o scanner de preços não exige login).
 * Privacy-first: a coordenada não é persistida nem logada — em caso de entrada
 * inválida a resposta 400 não ecoa os valores recebidos.
 */
export const GET = safeRoute(async (req: NextRequest) => {
  const limited = enforceRateLimit(req, 'geo-reverse', 30, 60_000);
  if (limited) {
    return limited;
  }

  const { searchParams } = req.nextUrl;
  const parsed = parseBody(geoReverseSchema, {
    lat: searchParams.get('lat'),
    lng: searchParams.get('lng'),
  });
  if (!parsed.ok) {
    return NextResponse.json(
      { error: 'Coordenadas inválidas.', message: 'Coordenadas inválidas.' },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  const { lat, lng } = parsed.data;
  if (!isInBrazil(lat, lng)) {
    return NextResponse.json({ data: null });
  }

  const m = nearestMunicipio(lat, lng);
  return NextResponse.json({ data: { ibge_code: m.ibge_code, city: m.name, state: m.uf } });
});
