/** Inteiro positivo da query string; ausente/inválido (`?page=abc`) cai no padrão. */
export function positiveInt(value: string | null, fallback: number, max = Number.MAX_SAFE_INTEGER) {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, max) : fallback;
}

/** Data da query string; ausente/inválida vira `undefined` (sem filtro). */
export function optionalDate(value: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function getPaginationParams(searchParams: URLSearchParams) {
  const page = positiveInt(searchParams.get('page'), 1);
  const perPage = searchParams.get('limit') ?? searchParams.get('perPage');
  const limit = positiveInt(perPage, 20, 100);
  const orderBy = searchParams.get('orderBy') ?? 'created_at';
  const sort = searchParams.get('order') ?? searchParams.get('sortedBy');
  const order: 'asc' | 'desc' = sort === 'asc' ? 'asc' : 'desc';
  return { page, limit, orderBy, order };
}

export function buildMeta(page: number, limit: number, total: number) {
  const last_page = Math.ceil(total / limit) || 1;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return { current_page: page, last_page, per_page: limit, from, to, total };
}
