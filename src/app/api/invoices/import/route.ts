import { unzipSync } from 'fflate';
import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { getSession } from '~/lib/auth/current-user';
import { enforceRateLimit } from '~/lib/rate-limit';
import { type ImportResult, importInvoice } from '~/services/invoice/import';

export const runtime = 'nodejs';

// Limites anti-abuso (o body comprimido já é limitado a 50 MB em next.config.mjs).
const MAX_FILE_BYTES = 50 * 1024 * 1024; // por arquivo enviado (comprimido)
const MAX_UNZIPPED_BYTES = 100 * 1024 * 1024; // total descompactado (zip bomb)
const MAX_ZIP_ENTRIES = 1000; // nº de arquivos dentro do .zip

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

  const names = Object.keys(unzipped);
  if (names.length > MAX_ZIP_ENTRIES) {
    throw new Error(`.zip com arquivos demais (limite ${MAX_ZIP_ENTRIES}).`);
  }
  // Guarda contra zip bomb: aborta se o total descompactado passar do teto.
  let total = 0;
  for (const name of names) {
    total += unzipped[name].length;
    if (total > MAX_UNZIPPED_BYTES) {
      throw new Error('Conteúdo descompactado excede o limite de 100 MB.');
    }
  }

  const decoder = new TextDecoder();
  return names
    .filter((name) => name.toLowerCase().endsWith('.xml'))
    .map((name) => ({ name, xml: decoder.decode(unzipped[name]) }));
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }
  const limited = enforceRateLimit(req, 'import', 60, 60 * 60 * 1000);
  if (limited) return limited;

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
    if (file.size > MAX_FILE_BYTES) {
      results.push({
        file: file.name,
        status: 'error',
        message: 'Arquivo acima do limite de 50 MB.',
      });
      continue;
    }

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
