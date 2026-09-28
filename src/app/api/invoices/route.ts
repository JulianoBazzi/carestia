import { StatusCodes } from 'http-status-codes';
import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '~/lib/auth/current-user';
import { errorResponse, safeRoute } from '~/lib/http';
import { buildMeta, optionalDate, positiveInt } from '~/lib/pagination';
import { firstIssue } from '~/schemas/auth';
import { invoiceCreateSchema, toItemInputs } from '~/schemas/invoice';
import { createInvoiceManual, listInvoices } from '~/services/invoice/queries';

export const runtime = 'nodejs';

const P2002 = 'P2002';

function parseType(v: string | null): 'nfe' | 'nfce' | 'nfse' | 'nf3e' | undefined {
  return v === 'nfe' || v === 'nfce' || v === 'nfse' || v === 'nf3e' ? v : undefined;
}

export const GET = safeRoute(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  const { searchParams } = new URL(req.url);
  const page = positiveInt(searchParams.get('page'), 1);
  const pageSize = positiveInt(searchParams.get('perPage'), 20, 100);

  const { rows, total } = await listInvoices({
    userId: session.sub,
    type: parseType(searchParams.get('type')),
    from: optionalDate(searchParams.get('from')),
    to: optionalDate(searchParams.get('to')),
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
  const parsed = invoiceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstIssue(parsed.error) },
      { status: StatusCodes.BAD_REQUEST },
    );
  }
  const input = parsed.data;

  try {
    const id = await createInvoiceManual(session.sub, {
      companyId: input.company_id,
      accessKey: input.access_key ?? `manual-${Date.now()}`,
      model: input.model,
      number: input.number,
      series: input.series,
      issuedAt: input.issued_at,
      neighborhood: input.neighborhood,
      city: input.city,
      state: input.state,
      items: toItemInputs(input.items),
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
