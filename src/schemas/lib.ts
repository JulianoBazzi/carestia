import { onlyAlphanumeric, onlyNumbers } from '@julianobazzi/utils';
import { z } from 'zod';

export const zulid = () => z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);

/** Texto obrigatório. `max` evita estourar o VarChar (que viraria 500). */
export const zrequired = (max = 255) =>
  z
    .string()
    .trim()
    .nonempty()
    .max(max, { message: `Máximo de ${max} caracteres.` });

export const znumbers = () =>
  z
    .string()
    .nonempty()
    .transform((v) => onlyNumbers(v));

export const zdocument = () =>
  z
    .string()
    .nonempty()
    .transform((v) => onlyAlphanumeric(v));

/** Texto opcional (vazio vira `null`). `max` evita estourar o VarChar. */
export const zoptional = (max = 255) =>
  z
    .string()
    .trim()
    .max(max, { message: `Máximo de ${max} caracteres.` })
    .nullable()
    .transform((value) => (value === '' ? null : value));

export const zulidOptional = () =>
  z.preprocess((val) => (val === '' ? undefined : val), zulid().optional());

export const zEmptyToUndefined = (value?: unknown) => (value === '' ? undefined : value);
