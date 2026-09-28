/**
 * Chave de acesso de NF-e/NFC-e (44 dígitos). Helpers puros — usados no client
 * (aba de QR do scanner) e nas rotas de importação por chave.
 *
 * Conteúdos que carregam a chave:
 *   - QR code v2 da NFC-e: `https://…/qrcode?p=<44 dígitos>|<versão>|<ambiente>|…|<hash>`
 *   - QR legado (v1):       `https://…?chNFe=<44 dígitos>&nVersao=…`
 *   - Código de barras Code-128 do DANFE/DANFE NFC-e: os 44 dígitos puros
 *   - Texto digitado/colado, com ou sem espaços de agrupamento
 */

const KEY_RE = /\d{44}/;

/** Modelo do documento: dígitos 21–22 da chave ('55' NF-e, '65' NFC-e). */
export function accessKeyModel(key: string): string {
  return key.slice(20, 22);
}

/** 44 dígitos + dígito verificador (mod 11, pesos 2..9 da direita para a esquerda). */
export function isValidAccessKey(key: string): boolean {
  if (!/^\d{44}$/.test(key)) {
    return false;
  }
  let sum = 0;
  let weight = 2;
  for (let i = 42; i >= 0; i--) {
    sum += Number(key[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rem = sum % 11;
  const dv = rem < 2 ? 0 : 11 - rem;
  return dv === Number(key[43]);
}

export type AccessKeyExtraction = { key: string; error?: never } | { key?: never; error: string };

/**
 * Localiza a chave de acesso em qualquer um dos formatos acima e a valida.
 * Devolve mensagem em pt-BR pronta para a UI quando não encontra/não confere.
 */
export function extractAccessKey(text: string): AccessKeyExtraction {
  const raw = String(text ?? '');
  // Primeiro no texto como veio; depois sem espaços (chave digitada em grupos).
  const match = raw.match(KEY_RE) ?? raw.replace(/\s+/g, '').match(KEY_RE);
  if (!match) {
    return { error: 'Não encontrei uma chave de acesso (44 dígitos) neste código.' };
  }
  const key = match[0];
  if (!isValidAccessKey(key)) {
    return { error: 'Chave de acesso inválida (dígito verificador não confere).' };
  }
  const model = accessKeyModel(key);
  if (model !== '55' && model !== '65') {
    return { error: 'Este código não é de uma NF-e/NFC-e.' };
  }
  return { key };
}
