import 'server-only';
import { extractText, getDocumentProxy } from 'unpdf';
import { extractDanfeFields, type IDanfeDraft } from '~/services/invoice/danfe-text';

export type { IDanfeDraft } from '~/services/invoice/danfe-text';
export { extractDanfeFields } from '~/services/invoice/danfe-text';

/**
 * Extrai o texto de uma conta de energia em PDF (DANF3e) e aplica as heurísticas.
 * PDFs escaneados (imagem) não têm texto extraível — nesse caso o resultado é
 * parcial e o usuário completa manualmente (OCR fica como evolução futura).
 */
export async function parseDanfePdf(buffer: ArrayBuffer): Promise<IDanfeDraft> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return extractDanfeFields(Array.isArray(text) ? text.join('\n') : text);
}
