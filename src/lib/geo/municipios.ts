import 'server-only';
import rows from '~/data/municipios.json';
import { normalizeName } from '~/lib/normalize';

/**
 * Resolução de município SEM geocoder externo: o dataset estático
 * `src/data/municipios.json` (IBGE + centróides, gerado por
 * `pnpm data:municipios`) fica em memória e a busca do município mais próximo
 * é uma varredura com haversine sobre ~5,6 mil linhas (< 1 ms).
 *
 * Privacy-first: a coordenada do usuário só passa por aqui para virar
 * cidade/UF/IBGE — nunca é persistida nem logada.
 */

export interface IMunicipio {
  ibge_code: string;
  name: string;
  uf: string;
  lat: number;
  lng: number;
}

type Row = [string, string, string, number, number];

const MUNICIPIOS: IMunicipio[] = (rows as Row[]).map(([ibge_code, name, uf, lat, lng]) => ({
  ibge_code,
  name,
  uf,
  lat,
  lng,
}));

// Caixa aproximada do território brasileiro (com folga).
const BBOX = { minLat: -34.5, maxLat: 6, minLng: -74.5, maxLng: -28 };

export function isInBrazil(lat: number, lng: number): boolean {
  return lat >= BBOX.minLat && lat <= BBOX.maxLat && lng >= BBOX.minLng && lng <= BBOX.maxLng;
}

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Distância em km entre duas coordenadas (haversine). */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/** Município cujo centróide está mais perto da coordenada. */
export function nearestMunicipio(lat: number, lng: number): IMunicipio {
  let best = MUNICIPIOS[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const m of MUNICIPIOS) {
    const d = distanceKm(lat, lng, m.lat, m.lng);
    if (d < bestDist) {
      bestDist = d;
      best = m;
    }
  }
  return best;
}

let byIbge: Map<string, IMunicipio> | null = null;
let byName: Map<string, IMunicipio> | null = null;

function nameKey(uf: string, name: string): string {
  return `${uf.toUpperCase()}|${normalizeName(name) ?? ''}`;
}

export function findMunicipioByIbge(code: string): IMunicipio | undefined {
  if (!byIbge) {
    byIbge = new Map(MUNICIPIOS.map((m) => [m.ibge_code, m]));
  }
  return byIbge.get(code);
}

/** Busca por UF + nome, tolerante a acento/caixa (mesma normalização do banco). */
export function findMunicipioByName(
  uf: string | null | undefined,
  name: string | null | undefined,
): IMunicipio | undefined {
  if (!uf || !name) {
    return undefined;
  }
  if (!byName) {
    byName = new Map(MUNICIPIOS.map((m) => [nameKey(m.uf, m.name), m]));
  }
  return byName.get(nameKey(uf, name));
}
