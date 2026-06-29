import { removeAccents } from '@julianobazzi/utils';

/** UPPERCASE + sem acento + trim. Usado em nomes de cadastro. */
export function normalizeName(value?: string | null): string | undefined {
  if (!value) return undefined;
  const out = removeAccents(String(value)).toUpperCase().trim();
  return out || undefined;
}

/** Slug minúsculo sem acento, hífens no lugar de espaços. */
export function slugify(value: string): string {
  return removeAccents(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
