import { onlyNumbers } from '@julianobazzi/utils';
import { z } from 'zod';
import { isCatalogGtin } from '~/lib/ean';
import { zoptional, zrequired } from '~/schemas/lib';

/**
 * EAN/GTIN opcional: só dígitos, 8 a 14 (a coluna é VarChar(14) e cobre
 * EAN-8/12/13 e GTIN-14). Vazio vira null.
 */
const zean = () =>
  z
    .string()
    .nullable()
    .transform((value) => {
      const digits = value ? onlyNumbers(value) : '';
      return digits === '' ? null : digits;
    })
    .refine((value) => value === null || isCatalogGtin(value), {
      message: 'EAN inválido: confira os dígitos (códigos internos de loja não valem).',
    });

export const itemSchema = z.object({
  // Trava de produto: neste momento o cadastro manual só cria produtos.
  type: z.literal('product'),
  name: zrequired(),
  // Opcional: itens vindos de NFC-e não têm NCM (ver `IItemInput`).
  reference_code: zoptional(20),
  ean: zean(),
  category_id: zoptional(26),
  unit: zoptional(10),
});

export type ItemData = z.infer<typeof itemSchema>;
export type ItemFormInput = z.input<typeof itemSchema>;

// Nome alternativo (alias) de um item; reference_code em branco herda o do item.
export const itemAliasSchema = z.object({
  name: zrequired(),
  reference_code: zoptional(20),
});

export type ItemAliasData = z.infer<typeof itemAliasSchema>;
