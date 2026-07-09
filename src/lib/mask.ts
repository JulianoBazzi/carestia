import { maskSecret } from '@julianobazzi/utils';

/** Mascara a chave de acesso da NF-e (44 dígitos) → "1234 •••• •••• •••• 7890". */
export function maskAccessKey(key?: string | null): string {
  if (!key) return '';
  return maskSecret(key, { visibleStart: 4, visibleEnd: 4, mask: ' •••• •••• •••• ' });
}
