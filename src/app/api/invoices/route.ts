import { StatusCodes } from 'http-status-codes';
import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '~/lib/auth/current-user';
import { buildMeta } from '~/lib/pagination';
import { listInvoices } from '~/services/invoice/queries';

export const runtime = 'nodejs';

function parseType(v: string | null): 'nfe' | 'nfse' | undefined {
  return v === 'nfe' || v === 'nfse' ? v : undefined;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const pageSize = Math.max(1, Math.min(100, Number(searchParams.get('perPage') ?? 20)));
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const { rows, total } = await listInvoices({
    userId: session.sub,
    type: parseType(searchParams.get('type')),
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    search: searchParams.get('search') || undefined,
    page,
    pageSize,
  });

  const data = rows.map((r) => ({
    id: r.id,
    model: r.model,
    number: r.number,
    series: r.series,
    access_key: r.access_key,
    issued_at: r.issued_at,
    total_value: r.total_value,
    company: {
      id: r.company.id,
      document: r.company.document,
      social_name: r.company.social_name,
      fantasy_name: r.company.fantasy_name,
    },
    items_count: r._count.items,
  }));

  return NextResponse.json({ data, meta: buildMeta(page, pageSize, total) });
}
