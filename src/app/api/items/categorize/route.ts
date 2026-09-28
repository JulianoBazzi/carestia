import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '~/lib/auth/current-user';
import prisma from '~/lib/prisma';
import { enforceRateLimit } from '~/lib/rate-limit';
import { setItemCategory } from '~/services/management';
import { categorizeItem, isAiEnabled } from '~/services/openai';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;

interface ICategorizeResult {
  id: string;
  name: string;
  category: string | null; // nome da categoria atribuída (ou null se não classificado)
  status: 'categorized' | 'failed';
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ message: 'Acesso negado.' }, { status: StatusCodes.FORBIDDEN });
  }
  // Rota só-admin e admin é isento do rate limit — a trava fica como salvaguarda
  // caso o acesso deixe de ser restrito a admins.
  const limited = enforceRateLimit(req, 'categorize', 20, 60 * 60 * 1000, session);
  if (limited) {
    return limited;
  }

  if (!isAiEnabled()) {
    return NextResponse.json(
      { message: 'Categorização por IA indisponível (OPENAI_API_KEY não configurado).' },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(
    Math.max(1, Math.trunc(Number((body as { limit?: unknown }).limit) || DEFAULT_LIMIT)),
    MAX_LIMIT,
  );

  const items = await prisma.item.findMany({
    where: { category_id: null, deleted_at: null },
    take: limit,
    select: { id: true, name: true, reference_code: true, type: true },
  });

  const categories = await prisma.category.findMany({
    where: { deleted_at: null },
    select: { id: true, slug: true, name: true },
  });
  const bySlug = new Map(categories.map((c) => [c.slug, c]));

  const results: ICategorizeResult[] = [];
  let categorized = 0;
  let failed = 0;
  // Item a item (sequencial), como pedido.
  for (const it of items) {
    const slug = await categorizeItem({
      name: it.name,
      referenceCode: it.reference_code,
      type: it.type,
    });
    const category = slug ? bySlug.get(slug) : undefined;
    if (category) {
      await setItemCategory(it.id, category.id);
      results.push({ id: it.id, name: it.name, category: category.name, status: 'categorized' });
      categorized += 1;
    } else {
      results.push({ id: it.id, name: it.name, category: null, status: 'failed' });
      failed += 1;
    }
  }

  const remaining = await prisma.item.count({ where: { category_id: null, deleted_at: null } });

  return NextResponse.json(
    { data: { processed: items.length, categorized, failed, remaining, results } },
    { status: StatusCodes.OK },
  );
}
