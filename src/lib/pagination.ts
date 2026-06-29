export function getPaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const perPage = searchParams.get('limit') ?? searchParams.get('perPage');
  const limit = Math.max(1, Math.min(100, Number(perPage ?? 20)));
  const orderBy = searchParams.get('orderBy') ?? 'created_at';
  const sort = searchParams.get('order') ?? searchParams.get('sortedBy');
  const order = sort === 'asc' ? 'asc' : 'desc';
  return { page, limit, orderBy, order };
}

export function buildMeta(page: number, limit: number, total: number) {
  const last_page = Math.ceil(total / limit) || 1;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return { current_page: page, last_page, per_page: limit, from, to, total };
}
