/**
 * Utilidades puras para GTIN/EAN (código de barras de produto). Sem dependência
 * de servidor — usado tanto na UI do scanner quanto nas rotas.
 *
 * O catálogo guarda o EAN como veio da nota (`cEAN`), que pode ter 8, 12, 13 ou
 * 14 dígitos. Um scanner pode ler o MESMO produto como UPC-A (12) ou EAN-13 com
 * zero à esquerda; por isso a consulta usa `eanCandidates` em vez de igualdade.
 */

/** Mesmo critério do parser de XML (`validEan`): 8, 12, 13 ou 14 dígitos. */
const EAN_RE = /^\d{8}$|^\d{12,14}$/;

/** Só dígitos. */
export function normalizeEan(raw: string | null | undefined): string {
  return String(raw ?? '').replace(/\D/g, '');
}

/** Tamanho aceito + dígito verificador GS1 (mod-10, pesos 3/1 da direita). */
export function isValidGtin(digits: string): boolean {
  if (!EAN_RE.test(digits)) {
    return false;
  }
  let sum = 0;
  for (let i = digits.length - 2, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) {
    sum += Number(digits[i]) * weight;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits[digits.length - 1]);
}

/**
 * GTIN que pode identificar um produto no catálogo GLOBAL: válido (tamanho +
 * dígito verificador) e fora das faixas de circulação restrita da GS1, que cada
 * loja/empresa reutiliza para coisas diferentes:
 * - 13 dígitos (e UPC-A/GTIN-14 normalizados para 13): prefixos `02`/`04`
 *   (uso interno e regional), `2` (peso variável — etiqueta de balança) e
 *   `98`/`99` (cupons e vales);
 * - EAN-8: prefixos `0` e `2` (RCN-8, circulação restrita).
 * Rejeita também o "código zerado" (`0000000000000`, que passa no checksum) —
 * vários ERPs o mandam no lugar de `SEM GTIN`. Sem esse filtro, produtos
 * diferentes de lojas diferentes seriam fundidos em um só item pelo atalho de
 * EAN da importação.
 */
export function isCatalogGtin(digits: string): boolean {
  if (!isValidGtin(digits)) {
    return false;
  }
  if (/^0+$/.test(digits.slice(0, -1))) {
    return false;
  }
  if (digits.length === 8) {
    return digits[0] !== '0' && digits[0] !== '2';
  }
  // GTIN-14 = indicador + 12 primeiros dígitos do GTIN-13 + DV próprio.
  const core13 = digits.length === 14 ? digits.slice(1) : digits.padStart(13, '0');
  return !/^(?:02|04|2|98|99)/.test(core13);
}

/**
 * Variantes equivalentes de um GTIN para a busca no catálogo: o próprio código,
 * as versões com zeros à esquerda (12→13→14) e, quando o código começa com zero,
 * a versão sem ele (14→13→12). Um GTIN-14 com indicador ≠ 0 é outro produto
 * (embalagem de agrupamento) e NÃO é reduzido. EAN-8 não se expande.
 */
export function eanCandidates(raw: string): string[] {
  const base = normalizeEan(raw);
  if (!EAN_RE.test(base)) {
    return [];
  }
  const out = new Set<string>([base]);
  if (base.length === 8) {
    return [base];
  }

  // Expansão com zeros à esquerda.
  let padded = base;
  while (padded.length < 14) {
    padded = `0${padded}`;
    if (EAN_RE.test(padded)) {
      out.add(padded);
    }
  }

  // Redução removendo zeros à esquerda enquanto continuar um tamanho válido.
  let stripped = base;
  while (stripped.startsWith('0') && stripped.length > 12) {
    stripped = stripped.slice(1);
    if (EAN_RE.test(stripped)) {
      out.add(stripped);
    }
  }

  return Array.from(out);
}
