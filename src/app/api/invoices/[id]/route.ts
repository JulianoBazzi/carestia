import { StatusCodes } from 'http-status-codes';
import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '~/lib/auth/current-user';
import {
  getInvoice,
  type IInvoiceItemInput,
  type InvoiceModelStr,
  softDeleteInvoice,
  updateInvoice,
} from '~/services/invoice/queries';

export const runtime = 'nodejs';

const MODELS = new Set(['nfe', 'nfce', 'nfse', 'nf3e']);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  const { id } = await params;
  const inv = await getInvoice(session.sub, id);
  if (!inv) {
    return NextResponse.json({ error: 'Nota não encontrada.' }, { status: StatusCodes.NOT_FOUND });
  }

  return NextResponse.json({
    data: {
      id: inv.id,
      model: inv.model,
      number: inv.number,
      series: inv.series,
      access_key: inv.access_key,
      issued_at: inv.issued_at,
      neighborhood: inv.neighborhood,
      city: inv.city,
      state: inv.state,
      company: {
        id: inv.company.id,
        document: inv.company.document,
        social_name: inv.company.social_name,
        fantasy_name: inv.company.fantasy_name,
      },
      items: inv.items.map((li) => ({
        description: li.description,
        reference_code: li.item.reference_code,
        unit: li.unit,
        unit_value: Number(li.unit_value),
      })),
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const model = MODELS.has(body.model) ? (body.model as InvoiceModelStr) : null;
  const number = typeof body.number === 'string' ? body.number.trim() : '';
  const issuedAt = body.issued_at ? new Date(body.issued_at) : null;
  if (!model || !number || !issuedAt || Number.isNaN(issuedAt.getTime())) {
    return NextResponse.json(
      { error: 'Modelo, número e data de emissão são obrigatórios.' },
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

  const count = await updateInvoice(session.sub, id, {
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
  if (count === 0) {
    return NextResponse.json({ error: 'Nota não encontrada.' }, { status: StatusCodes.NOT_FOUND });
  }
  return NextResponse.json({ data: { id } }, { status: StatusCodes.OK });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  const { id } = await params;
  const count = await softDeleteInvoice(session.sub, id);
  if (count === 0) {
    return NextResponse.json({ error: 'Nota não encontrada.' }, { status: StatusCodes.NOT_FOUND });
  }

  return NextResponse.json({ ok: true }, { status: StatusCodes.OK });
}
