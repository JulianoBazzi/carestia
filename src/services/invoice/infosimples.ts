import 'server-only';
import { onlyNumbers } from '@julianobazzi/utils';
import { infosimplesNfceSchema } from '~/schemas/infosimples';
import { parseInfosimplesNfce } from '~/services/invoice/infosimples-nfce';
import type { IParsedInvoice } from '~/services/invoice/parser';

/**
 * Integração com a API Infosimples para consultar notas fiscais a partir da
 * chave de acesso (44 dígitos). Fica atrás da env `INFOSIMPLES_TOKEN`: sem o
 * token, `isInfosimplesEnabled()` retorna false e a UI exibe um aviso.
 *
 * Docs: https://infosimples.com/consultas/ — endpoints unificados:
 *   - sefaz-nfe   (NF-e, modelo 55)  → parâmetro `nfe`,  devolve `url_xml`
 *   - sefaz-nfce  (NFC-e, modelo 65) → parâmetro `nfce`, NÃO devolve `url_xml`
 *
 * Dois caminhos, por isso: quando há `url_xml` reaproveitamos o parser de XML
 * (mais rico — traz NCM e GTIN); a NFC-e só existe como JSON estruturado e passa
 * pelo adaptador em `infosimples-nfce.ts`.
 */

const BASE = 'https://api.infosimples.com/api/v2/consultas';
// Consulta SEFAZ pode demorar (body pede timeout: 600), mas sem teto o fetch pende
// indefinidamente; 60s corta hangs de rede. O download do XML é rápido → 15s.
const QUERY_TIMEOUT_MS = 60_000;
const DOWNLOAD_TIMEOUT_MS = 15_000;

export function isInfosimplesEnabled(): boolean {
  return Boolean(process.env.INFOSIMPLES_TOKEN);
}

/**
 * Endpoint e nome do parâmetro, decididos pelo modelo nos dígitos 21–22 da chave.
 * O nome do parâmetro MUDA por endpoint (`nfe` vs `nfce`) — mandar o errado faz a
 * consulta falhar antes de qualquer coisa.
 */
function consultaForKey(key: string): { endpoint: string; param: 'nfe' | 'nfce' } {
  if (key.slice(20, 22) === '65') {
    return { endpoint: 'sefaz-nfce', param: 'nfce' };
  }
  // NFS-e não usa chave de 44 dígitos no mesmo formato; mantém NF-e como padrão.
  return { endpoint: 'sefaz-nfe', param: 'nfe' };
}

export type InfosimplesOutcome =
  | { status: 'xml'; xml: string }
  | { status: 'parsed'; parsed: IParsedInvoice }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

async function downloadXml(url: string): Promise<InfosimplesOutcome> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (!res.ok) {
      return { status: 'error', message: 'Não foi possível baixar o XML da nota.' };
    }
    return { status: 'xml', xml: await res.text() };
  } catch (e) {
    return { status: 'error', message: `Falha ao baixar XML: ${(e as Error).message}` };
  }
}

/** Consulta a chave na Infosimples e devolve a nota (XML ou já estruturada). */
export async function fetchInvoiceByKey(accessKey: string): Promise<InfosimplesOutcome> {
  const token = process.env.INFOSIMPLES_TOKEN;
  if (!token) {
    return { status: 'error', message: 'Integração Infosimples não configurada.' };
  }

  const key = onlyNumbers(accessKey);
  if (key.length !== 44) {
    return { status: 'error', message: 'Chave de acesso inválida (esperado 44 dígitos).' };
  }

  const { endpoint, param } = consultaForKey(key);

  let payload: { code?: number; code_message?: string; data?: unknown[] };
  try {
    const res = await fetch(`${BASE}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, [param]: key, timeout: 600 }),
      signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
    });
    payload = await res.json();
  } catch (e) {
    return { status: 'error', message: `Falha ao consultar Infosimples: ${(e as Error).message}` };
  }

  // Infosimples: code 200 = sucesso; 6xx = nota não encontrada / indisponível.
  if (payload.code !== 200 || !Array.isArray(payload.data) || payload.data.length === 0) {
    if (payload.code && payload.code >= 600 && payload.code < 700) {
      return { status: 'not_found' };
    }
    return { status: 'error', message: payload.code_message || 'Falha na consulta da nota.' };
  }

  const record = payload.data[0] as { url_xml?: string; cancelada?: boolean };

  // Nota cancelada não representa uma compra — importá-la sujaria a série de preços.
  if (record.cancelada === true) {
    return { status: 'error', message: 'Nota fiscal cancelada.' };
  }

  // XML tem precedência quando existe: traz NCM e GTIN, que o JSON da NFC-e não tem.
  if (record.url_xml) {
    return downloadXml(record.url_xml);
  }

  if (param === 'nfce') {
    const validated = infosimplesNfceSchema.safeParse(record);
    if (!validated.success) {
      return { status: 'error', message: 'Resposta da Infosimples em formato inesperado.' };
    }
    try {
      return { status: 'parsed', parsed: parseInfosimplesNfce(validated.data) };
    } catch (e) {
      return { status: 'error', message: (e as Error).message };
    }
  }

  return { status: 'error', message: 'Consulta sem XML disponível para esta nota.' };
}
