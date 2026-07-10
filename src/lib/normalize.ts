import { removeAccents } from '@julianobazzi/utils';

/** UPPERCASE + sem acento + trim. Usado em nomes de cadastro. */
export function normalizeName(value?: string | null): string | undefined {
  if (!value) return undefined;
  const out = removeAccents(String(value)).toUpperCase().replace(/\s+/g, ' ').trim();
  return out || undefined;
}

/**
 * Chave de comparação para casar variações de escrita do MESMO produto.
 * Reaproveita `normalizeName` (UPPERCASE + sem acento + espaços colapsados) e
 * remove pontuação, de modo que "S-10", "S 10" e "S10." colapsem na comparação.
 * Usado só no matching (pg_trgm); o nome de exibição continua vindo de `normalizeName`.
 */
export function matchKey(value?: string | null): string {
  const n = normalizeName(value);
  if (!n) return '';
  return n
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Slug minúsculo sem acento, hífens no lugar de espaços. */
export function slugify(value: string): string {
  return removeAccents(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
