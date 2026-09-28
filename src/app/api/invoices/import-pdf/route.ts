import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { getSession } from '~/lib/auth/current-user';
import { enforceRateLimit } from '~/lib/rate-limit';
import { parseDanfePdf } from '~/services/invoice/danfe-pdf';

export const runtime = 'nodejs';

const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

// Extrai (best-effort) os dados de uma conta de energia em PDF para REVISÃO manual.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }
  const limited = enforceRateLimit(req, 'import-pdf', 60, 60 * 60 * 1000, session);
  if (limited) {
    return limited;
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Envie o PDF no campo 'file'." },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    return NextResponse.json(
      { error: 'Envie um arquivo PDF.' },
      { status: StatusCodes.UNSUPPORTED_MEDIA_TYPE },
    );
  }
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json(
      { error: 'PDF acima do limite de 10 MB.' },
      { status: StatusCodes.REQUEST_TOO_LONG },
    );
  }

  try {
    const draft = await parseDanfePdf(await file.arrayBuffer());
    return NextResponse.json({ data: draft });
  } catch (e) {
    console.error('[import-pdf] falha ao ler PDF:', e);
    return NextResponse.json(
      {
        error:
          'Não foi possível ler o PDF. Verifique se é uma conta de energia em PDF (não escaneada).',
      },
      { status: StatusCodes.BAD_REQUEST },
    );
  }
}
