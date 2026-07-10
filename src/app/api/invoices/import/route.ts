import { unzipSync } from 'fflate';
import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { getSession } from '~/lib/auth/current-user';
import { type ImportResult, importInvoice } from '~/services/invoice/import';

export const runtime = 'nodejs';

interface IEntry {
  name: string;
  xml: string;
}

/** Expande um File em entradas XML (descompacta .zip). */
async function toXmlEntries(file: File): Promise<IEntry[]> {
  const isZip = file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip';

  if (!isZip) {
    return [{ name: file.name, xml: await file.text() }];
  }

  const buf = new Uint8Array(await file.arrayBuffer());
  const unzipped = unzipSync(buf);
  const decoder = new TextDecoder();
  return Object.entries(unzipped)
    .filter(([name]) => name.toLowerCase().endsWith('.xml'))
    .map(([name, data]) => ({ name, xml: decoder.decode(data) }));
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json(
      {
        error:
          'Não foi possível ler o envio. Se for um .zip grande, ele pode ter excedido o limite de 50 MB — tente dividir em partes.',
      },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  const files = form.getAll('file').filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json(
      { error: 'Nenhum arquivo enviado.' },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  const seenKeys = new Set<string>();
  const results: Array<{ file: string } & ImportResult> = [];

  for (const file of files) {
    let entries: IEntry[];
    try {
      entries = await toXmlEntries(file);
    } catch (e) {
      results.push({
        file: file.name,
        status: 'error',
        message: `Falha ao ler arquivo: ${(e as Error).message}`,
      });
      continue;
    }

    for (const entry of entries) {
      const result = await importInvoice(session.sub, entry.xml, seenKeys);
      results.push({ file: entry.name, ...result });
    }
  }

  const summary = {
    imported: results.filter((r) => r.status === 'imported').length,
    duplicated: results.filter((r) => r.status === 'duplicated').length,
    errors: results.filter((r) => r.status === 'error').length,
  };

  return NextResponse.json({ summary, results }, { status: StatusCodes.OK });
}
