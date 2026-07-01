import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { getSession } from '~/lib/auth/current-user';
import { parseDanfePdf } from '~/services/invoice/danfe-pdf';

export const runtime = 'nodejs';

// Extrai (best-effort) os dados de uma conta de energia em PDF para REVISÃO manual.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Envie o PDF no campo 'file'." },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  try {
    const draft = await parseDanfePdf(await file.arrayBuffer());
    return NextResponse.json({ data: draft });
  } catch (e) {
    return NextResponse.json(
      { error: `Não foi possível ler o PDF: ${(e as Error).message}` },
      { status: StatusCodes.BAD_REQUEST },
    );
  }
}
