import 'server-only';
import { onlyNumbers } from '@julianobazzi/utils';

/**
 * Integração com a API Infosimples para consultar e baixar notas fiscais a partir
 * da chave de acesso (44 dígitos). Fica atrás da env `INFOSIMPLES_TOKEN`: sem o
 * token, `isInfosimplesEnabled()` retorna false e a UI exibe um aviso.
 *
 * Docs: https://infosimples.com/consultas/ — endpoints unificados:
 *   - sefaz-nfe            (NF-e, modelo 55)
 *   - sefaz-nfce           (NFC-e, modelo 65)
 *   - receita-federal-nfse (NFS-e nacional)
 * A resposta traz dados estruturados e `url_xml` (link p/ o XML), que reaproveitamos
 * no parser/persistência já existentes.
 */

const BASE = 'https://api.infosimples.com/api/v2/consultas';
// Consulta SEFAZ pode demorar (body pede timeout: 600), mas sem teto o fetch pende
// indefinidamente; 60s corta hangs de rede. O download do XML é rápido → 15s.
const QUERY_TIMEOUT_MS = 60_000;
const DOWNLOAD_TIMEOUT_MS = 15_000;

export function isInfosimplesEnabled(): boolean {
  return Boolean(process.env.INFOSIMPLES_TOKEN);
}

/** O modelo está nos dígitos 21–22 da chave de acesso. */
function endpointForKey(key: string): string {
  const mod = key.slice(20, 22);
  if (mod === '65') return 'sefaz-nfce';
  if (mod === '55') return 'sefaz-nfe';
  // NFS-e não usa chave de 44 dígitos no mesmo formato; mantém NF-e como padrão.
  return 'sefaz-nfe';
}

export type InfosimplesOutcome =
  | { status: 'xml'; xml: string }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

/** Consulta a chave na Infosimples e retorna o XML quando disponível. */
export async function fetchInvoiceXmlByKey(accessKey: string): Promise<InfosimplesOutcome> {
  const token = process.env.INFOSIMPLES_TOKEN;
  if (!token) {
    return { status: 'error', message: 'Integração Infosimples não configurada.' };
  }

  const key = onlyNumbers(accessKey);
  if (key.length !== 44) {
    return { status: 'error', message: 'Chave de acesso inválida (esperado 44 dígitos).' };
  }

  let payload: { code?: number; code_message?: string; data?: unknown[] };
  try {
    const res = await fetch(`${BASE}/${endpointForKey(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, nfe: key, timeout: 600 }),
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

  const record = payload.data[0] as { url_xml?: string };
  if (!record.url_xml) {
    return { status: 'error', message: 'Consulta sem XML disponível para esta nota.' };
  }

  try {
    const xmlRes = await fetch(record.url_xml, {
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
    if (!xmlRes.ok) {
      return { status: 'error', message: 'Não foi possível baixar o XML da nota.' };
    }
    return { status: 'xml', xml: await xmlRes.text() };
  } catch (e) {
    return { status: 'error', message: `Falha ao baixar XML: ${(e as Error).message}` };
  }
}
