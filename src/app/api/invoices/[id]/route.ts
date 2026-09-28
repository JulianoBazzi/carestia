import { StatusCodes } from 'http-status-codes';
import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '~/lib/auth/current-user';
import { errorResponse } from '~/lib/http';
import { firstIssue } from '~/schemas/auth';
import { invoiceWriteSchema, toItemInputs } from '~/schemas/invoice';
import { getInvoice, softDeleteInvoice, updateInvoice } from '~/services/invoice/queries';

export const runtime = 'nodejs';

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
        id: li.id,
        description: li.description,
        reference_code: li.item.reference_code,
        unit: li.unit,
        unit_value: Number(li.unit_value),
        unit_tax_value: li.unit_tax_value == null ? null : Number(li.unit_tax_value),
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
  const parsed = invoiceWriteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstIssue(parsed.error) },
      { status: StatusCodes.BAD_REQUEST },
    );
  }
  const input = parsed.data;

  try {
    const count = await updateInvoice(session.sub, id, {
      model: input.model,
      number: input.number,
      series: input.series,
      issuedAt: input.issued_at,
      neighborhood: input.neighborhood,
      city: input.city,
      state: input.state,
      items: toItemInputs(input.items),
    });
    if (count === 0) {
      return NextResponse.json(
        { error: 'Nota não encontrada.' },
        { status: StatusCodes.NOT_FOUND },
      );
    }
    return NextResponse.json({ data: { id } }, { status: StatusCodes.OK });
  } catch (e) {
    return errorResponse(e);
  }
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
