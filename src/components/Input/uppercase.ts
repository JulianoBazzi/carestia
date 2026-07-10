import type { ChangeEvent } from 'react';
import { toUpperLive } from '~/lib/normalize';

/** Tipos de input que nunca devem virar maiúscula (não são texto livre). */
const NO_UPPER_TYPES = new Set([
  'email',
  'password',
  'number',
  'date',
  'datetime-local',
  'time',
  'tel',
  'url',
]);

/**
 * Decide se o campo deve transformar em maiúscula ao vivo.
 * Default ON para texto livre; opt-out via prop `uppercase={false}` ou pelo `type`.
 */
export function shouldUppercase(uppercase: boolean | undefined, type?: string): boolean {
  if (uppercase === false) return false;
  if (type && NO_UPPER_TYPES.has(type)) return false;
  return true;
}

/**
 * Envolve o `onChange` para aplicar `toUpperLive` (UPPERCASE + sem acento) no valor
 * digitado. Mantém o mesmo evento (mesmo comprimento → cursor preservado).
 */
export function wrapUppercase<T extends HTMLInputElement | HTMLTextAreaElement>(
  onChange: ((e: ChangeEvent<T>) => void) | undefined,
  active: boolean,
): ((e: ChangeEvent<T>) => void) | undefined {
  if (!active || !onChange) return onChange;
  return (e) => {
    e.target.value = toUpperLive(e.target.value);
    onChange(e);
  };
}
