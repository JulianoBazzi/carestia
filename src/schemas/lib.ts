import { onlyAlphanumeric, onlyNumbers } from '@julianobazzi/utils';
import { z } from 'zod';

export const zulid = () => z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);

export const zrequired = () => z.string().nonempty();

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

export const zoptional = () =>
  z
    .string()
    .nullable()
    .transform((value) => (value === '' ? null : value));

export const zulidOptional = () =>
  z.preprocess((val) => (val === '' ? undefined : val), zulid().optional());

export const zEmptyToUndefined = (value?: unknown) => (value === '' ? undefined : value);
