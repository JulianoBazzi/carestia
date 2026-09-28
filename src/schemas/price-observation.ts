import { z } from 'zod';
import { isCatalogGtin, normalizeEan } from '~/lib/ean';
import { isUf } from '~/lib/ufs';

/** Texto livre opcional: vazio/nulo vira `undefined`. */
const zfreeText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : undefined));

/**
 * Observação de preço de gôndola (etiqueta lida no scanner). Só preço unitário +
 * cidade/UF — nada que identifique a loja ou o usuário.
 */
export const priceObservationSchema = z.object({
  ean: z
    .string()
    .transform((v) => normalizeEan(v))
    .refine(isCatalogGtin, { message: 'Código de barras inválido ou interno da loja.' }),
  // Obrigatório só quando o EAN ainda não está no catálogo (checado no serviço).
  name: zfreeText(255),
  unit: zfreeText(10),
  unit_value: z
    .number({ message: 'Informe o preço.' })
    .positive({ message: 'O preço deve ser maior que zero.' })
    .lt(1_000_000, { message: 'Preço fora do limite.' }),
  city: z.string().trim().min(2, { message: 'Informe a cidade.' }).max(255),
  state: z.string().trim().toUpperCase().refine(isUf, { message: 'UF inválida.' }),
  ibge_code: z
    .string()
    .regex(/^\d{7}$/, { message: 'Código IBGE inválido.' })
    .nullish()
    .transform((v) => v ?? undefined),
});

export type PriceObservationInput = z.infer<typeof priceObservationSchema>;
