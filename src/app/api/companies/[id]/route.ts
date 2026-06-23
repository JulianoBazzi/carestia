import { NextResponse } from 'next/server';
import { getSession } from '~/lib/auth/current-user';
import { type ICompanyUpdate, updateCompany } from '~/services/management';

export const runtime = 'nodejs';

const FIELDS: (keyof ICompanyUpdate)[] = [
  'social_name',
  'fantasy_name',
  'street',
  'number',
  'neighborhood',
  'city',
  'state',
  'zipcode',
];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const data: ICompanyUpdate = {};
  for (const field of FIELDS) {
    if (field in body) {
      const value = body[field];
      (data as Record<string, unknown>)[field] = value === '' ? null : value;
    }
  }
  if (!data.social_name) {
    return NextResponse.json({ error: 'Razão social é obrigatória.' }, { status: 400 });
  }

  const count = await updateCompany(id, data);
  if (count === 0) {
    return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
