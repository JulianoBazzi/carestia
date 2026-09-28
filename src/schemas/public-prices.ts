import { z } from 'zod';
import { isUf } from '~/lib/ufs';

/** Query de `GET /api/public/prices/ean/[ean]` — região opcional do usuário. */
export const eanLookupQuerySchema = z.object({
  state: z.string().trim().toUpperCase().refine(isUf, { message: 'UF inválida.' }).optional(),
  city: z.string().trim().min(1).max(255).optional(),
  ibge_code: z
    .string()
    .regex(/^\d{7}$/, { message: 'Código IBGE inválido.' })
    .optional(),
});

export type EanLookupQuery = z.infer<typeof eanLookupQuerySchema>;
