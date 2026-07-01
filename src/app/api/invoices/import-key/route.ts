import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { getSession } from '~/lib/auth/current-user';
import prisma from '~/lib/prisma';
import { importInvoice } from '~/services/invoice/import';
import { fetchInvoiceXmlByKey, isInfosimplesEnabled } from '~/services/invoice/infosimples';

export const runtime = 'nodejs';

export type KeyImportStatus = 'imported' | 'duplicated' | 'not_found' | 'error';

interface KeyResult {
  key: string;
  status: KeyImportStatus;
  message?: string;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  if (!isInfosimplesEnabled()) {
    return NextResponse.json(
      { error: 'Integração Infosimples não configurada.' },
      { status: StatusCodes.SERVICE_UNAVAILABLE },
    );
  }

  const body = await req.json().catch(() => ({}));
  const rawKeys: string[] = Array.isArray(body.keys) ? body.keys : [];
  const keys = Array.from(
    new Set(rawKeys.map((k) => String(k).replace(/\D/g, '')).filter((k) => k.length === 44)),
  );

  if (keys.length === 0) {
    return NextResponse.json(
      { error: 'Envie ao menos uma chave de acesso válida (44 dígitos).' },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  // Dedup contra notas já importadas — evita gastar consulta paga repetida.
  const existing = await prisma.invoice.findMany({
    where: { user_id: session.sub, access_key: { in: keys }, deleted_at: null },
    select: { access_key: true },
  });
  const existingKeys = new Set(existing.map((e) => e.access_key));

  const results: KeyResult[] = [];
  for (const key of keys) {
    if (existingKeys.has(key)) {
      results.push({ key, status: 'duplicated' });
      continue;
    }

    const outcome = await fetchInvoiceXmlByKey(key);
    if (outcome.status === 'not_found') {
      results.push({ key, status: 'not_found' });
      continue;
    }
    if (outcome.status === 'error') {
      results.push({ key, status: 'error', message: outcome.message });
      continue;
    }

    const imported = await importInvoice(session.sub, outcome.xml);
    if (imported.status === 'imported') {
      results.push({ key, status: 'imported' });
    } else if (imported.status === 'duplicated') {
      results.push({ key, status: 'duplicated' });
    } else {
      results.push({ key, status: 'error', message: imported.message });
    }
  }

  const summary = {
    imported: results.filter((r) => r.status === 'imported').length,
    duplicated: results.filter((r) => r.status === 'duplicated').length,
    notFound: results.filter((r) => r.status === 'not_found').length,
    errors: results.filter((r) => r.status === 'error').length,
  };

  return NextResponse.json({ summary, results }, { status: StatusCodes.OK });
}
