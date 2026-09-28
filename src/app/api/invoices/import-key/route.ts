import { onlyNumbers } from '@julianobazzi/utils';
import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { isValidAccessKey } from '~/lib/access-key';
import { getSession, isAdmin } from '~/lib/auth/current-user';
import { safeRoute } from '~/lib/http';
import prisma from '~/lib/prisma';
import {
  checkRateLimit,
  DAY_MS,
  enforceRateLimit,
  rateLimitResponse,
  refundRateLimit,
} from '~/lib/rate-limit';
import { importInvoice, importParsedInvoice } from '~/services/invoice/import';
import { fetchInvoiceByKey, isInfosimplesEnabled } from '~/services/invoice/infosimples';

export const runtime = 'nodejs';

export type KeyImportStatus = 'imported' | 'duplicated' | 'not_found' | 'error';

// A consulta na Infosimples é PAGA. A rota atende qualquer usuário logado (o
// scanner lê o QR da NFC-e), então o custo é contido em três camadas — todas
// puladas para admin, que também usa a tela de importação em lote:
/** Chaves por requisição (o scanner manda uma por vez). */
const MAX_KEYS_PER_REQUEST = 5;
/** Consultas por usuário por dia (cada chave conta uma unidade). */
const USER_DAILY_LIMIT = 20;
/** Consultas por dia somando todos os usuários. */
const GLOBAL_DAILY_LIMIT = 500;
/** Teto de chaves por requisição do admin (tela em lote). */
const ADMIN_MAX_KEYS_PER_REQUEST = 1000;
const GLOBAL_KEY = 'import-key:global';

interface KeyResult {
  key: string;
  status: KeyImportStatus;
  message?: string;
}

export const POST = safeRoute(async (req: Request) => {
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

  const admin = isAdmin(session);
  const body = await req.json().catch(() => ({}));
  // Corta antes de processar: um array gigante não pode custar CPU. `+1` mantém
  // a mensagem de "máximo de N chaves" para quem passou do limite.
  const rawKeys: unknown[] = Array.isArray(body.keys)
    ? body.keys.slice(0, admin ? ADMIN_MAX_KEYS_PER_REQUEST : MAX_KEYS_PER_REQUEST + 1)
    : [];
  // Valida o dígito verificador ANTES de gastar consulta paga com chave digitada errado.
  const keys = Array.from(
    new Set(rawKeys.map((k) => onlyNumbers(String(k))).filter((k) => isValidAccessKey(k))),
  );

  if (keys.length === 0) {
    return NextResponse.json(
      { error: 'Envie ao menos uma chave de acesso válida (44 dígitos).' },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  if (!admin && keys.length > MAX_KEYS_PER_REQUEST) {
    return NextResponse.json(
      { error: `Máximo de ${MAX_KEYS_PER_REQUEST} chaves por requisição.` },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  // Dedup contra notas já importadas — evita gastar consulta paga repetida.
  const existing = await prisma.invoice.findMany({
    where: { user_id: session.sub, access_key: { in: keys }, deleted_at: null },
    select: { access_key: true },
  });
  const existingKeys = new Set(existing.map((e) => e.access_key));

  // Só as chaves que vão de fato à Infosimples consomem cota — reler o QR de uma
  // nota já importada não custa nada.
  const billable = keys.filter((k) => !existingKeys.has(k)).length;
  // Teto global primeiro (se recusar, o usuário não perde cota); se a cota do
  // usuário recusar, as unidades globais voltam.
  if (billable > 0) {
    if (!admin) {
      const global = checkRateLimit(GLOBAL_KEY, GLOBAL_DAILY_LIMIT, DAY_MS, billable);
      if (!global.ok) {
        return rateLimitResponse(global.retryAfter);
      }
    }
    const limited = enforceRateLimit(req, 'import-key', USER_DAILY_LIMIT, DAY_MS, session, {
      by: 'user',
      cost: billable,
    });
    if (limited) {
      if (!admin) {
        refundRateLimit(GLOBAL_KEY, billable);
      }
      return limited;
    }
  }

  const results: KeyResult[] = [];
  for (const key of keys) {
    if (existingKeys.has(key)) {
      results.push({ key, status: 'duplicated' });
      continue;
    }

    const outcome = await fetchInvoiceByKey(key);
    if (outcome.status === 'not_found') {
      results.push({ key, status: 'not_found' });
      continue;
    }
    if (outcome.status === 'error') {
      results.push({ key, status: 'error', message: outcome.message });
      continue;
    }

    // NF-e devolve XML; NFC-e só existe como JSON e já vem estruturada.
    const imported =
      outcome.status === 'xml'
        ? await importInvoice(session.sub, outcome.xml)
        : await importParsedInvoice(session.sub, outcome.parsed);
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
});
