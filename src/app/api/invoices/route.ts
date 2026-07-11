import { StatusCodes } from 'http-status-codes';
import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '~/lib/auth/current-user';
import { errorResponse, safeRoute } from '~/lib/http';
import { buildMeta } from '~/lib/pagination';
import {
  createInvoiceManual,
  type IInvoiceItemInput,
  type InvoiceModelStr,
  listInvoices,
} from '~/services/invoice/queries';

export const runtime = 'nodejs';

const P2002 = 'P2002';
const MODELS = new Set(['nfe', 'nfce', 'nfse', 'nf3e']);

function parseType(v: string | null): 'nfe' | 'nfce' | 'nfse' | 'nf3e' | undefined {
  return v === 'nfe' || v === 'nfce' || v === 'nfse' || v === 'nf3e' ? v : undefined;
}

export const GET = safeRoute(async (req: NextRequest) => {
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
    companyId: searchParams.get('company') || undefined,
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
    company: {
      id: r.company.id,
      document: r.company.document,
      social_name: r.company.social_name,
      fantasy_name: r.company.fantasy_name,
    },
    items_count: r._count.items,
  }));

  return NextResponse.json({ data, meta: buildMeta(page, pageSize, total) });
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  const body = await req.json().catch(() => ({}));
  const model = MODELS.has(body.model) ? (body.model as InvoiceModelStr) : null;
  const number = typeof body.number === 'string' ? body.number.trim() : '';
  const companyId = typeof body.company_id === 'string' ? body.company_id : '';
  const accessKey =
    typeof body.access_key === 'string' && body.access_key.trim()
      ? body.access_key.trim()
      : `manual-${Date.now()}`;
  const issuedAt = body.issued_at ? new Date(body.issued_at) : null;
  if (!model || !number || !companyId || !issuedAt || Number.isNaN(issuedAt.getTime())) {
    return NextResponse.json(
      { error: 'Modelo, emitente, número e data de emissão são obrigatórios.' },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  const items: IInvoiceItemInput[] = Array.isArray(body.items)
    ? body.items
        .filter(
          (it: { description?: string }) =>
            typeof it?.description === 'string' && it.description.trim(),
        )
        .map((it: Record<string, unknown>) => ({
          description: String(it.description).trim(),
          referenceCode: typeof it.reference_code === 'string' ? it.reference_code.trim() : '',
          unit: typeof it.unit === 'string' && it.unit ? it.unit : null,
          unitValue: Number(it.unit_value) || 0,
        }))
    : [];

  try {
    const id = await createInvoiceManual(session.sub, {
      companyId,
      accessKey,
      model,
      number,
      series: typeof body.series === 'string' && body.series ? body.series : null,
      issuedAt,
      neighborhood:
        typeof body.neighborhood === 'string' && body.neighborhood ? body.neighborhood : null,
      city: typeof body.city === 'string' && body.city ? body.city : null,
      state: typeof body.state === 'string' && body.state ? body.state : null,
      items,
    });
    return NextResponse.json({ data: { id } }, { status: StatusCodes.CREATED });
  } catch (e) {
    if (
      typeof e === 'object' &&
      e !== null &&
      'code' in e &&
      (e as { code: string }).code === P2002
    ) {
      return NextResponse.json(
        { error: 'Já existe uma nota com esta chave de acesso.' },
        { status: StatusCodes.CONFLICT },
      );
    }
    return errorResponse(e);
  }
}
