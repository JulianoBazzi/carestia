import { z } from 'zod';
import { zoptional, zrequired } from '~/schemas/lib';

export const itemSchema = z.object({
  type: z.enum(['product', 'service']),
  name: zrequired(),
  // Opcional: itens vindos de NFC-e não têm NCM (ver `IItemInput`).
  reference_code: zoptional(),
  category_id: zoptional(),
  unit: zoptional(),
});

export type ItemData = z.infer<typeof itemSchema>;
export type ItemFormInput = z.input<typeof itemSchema>;

// Nome alternativo (alias) de um item; reference_code em branco herda o do item.
export const itemAliasSchema = z.object({
  name: zrequired(),
  reference_code: zoptional(),
});

export type ItemAliasData = z.infer<typeof itemAliasSchema>;
