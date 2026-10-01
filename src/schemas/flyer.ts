import { z } from 'zod';
import { toDateInputValue } from '~/lib/format';
import { isUf } from '~/lib/ufs';
import { zulid } from '~/schemas/lib';

/** Itens por gravação — o mesmo teto da leitura de uma imagem. */
export const FLYER_MAX_ITEMS_PER_SAVE = 100;
/** Cidades por encarte: uma observação por cidade, então o teto contém o volume. */
export const FLYER_MAX_CITIES = 10;

/**
 * Corpo de `POST /api/flyers/read`: o encarte como data URL JPEG. O client
 * reduz a imagem (lado maior ≤ 2048 px — encarte tem letra miúda); o teto é só
 * salvaguarda contra payload abusivo.
 */
export const flyerReadSchema = z.object({
  image: z
    .string({ message: 'Envie a imagem do encarte.' })
    .startsWith('data:image/jpeg;base64,', { message: 'Formato de imagem inválido.' })
    .max(4_000_000, { message: 'Imagem muito grande.' }),
});

const zprice = (message: string) =>
  z
    .number({ message })
    .positive({ message: 'O preço deve ser maior que zero.' })
    .lt(1_000_000, { message: 'Preço fora do limite.' });

/** Dia de calendário real em `yyyy-mm-dd`. */
function isCalendarDay(value: string): boolean {
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export const flyerItemSchema = z.object({
  /** Item do catálogo escolhido na revisão; sem ele, o nome casa/cria o item. */
  item_id: zulid()
    .nullish()
    .transform((v) => v ?? undefined),
  name: z.string().trim().min(2, { message: 'Informe o nome do produto.' }).max(255),
  unit: z
    .string()
    .trim()
    .max(10)
    .nullish()
    .transform((v) => (v ? v : undefined)),
  unit_value: zprice('Informe o preço.'),
  regular_value: zprice('Preço "de" inválido.')
    .nullish()
    .transform((v) => v ?? undefined),
});

/**
 * Corpo de `POST /api/flyers/observations` (só-admin): os itens revisados de
 * UM encarte + a região e o dia em que as ofertas valem. Sem cidades, a
 * observação vale para a UF inteira (`city = null`).
 */
export const flyerObservationsSchema = z.object({
  observed_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data inválida.' })
    .refine(isCalendarDay, { message: 'Data inválida.' })
    // Comparação de strings yyyy-mm-dd no fuso de Brasília.
    .refine((v) => v <= toDateInputValue(new Date()), {
      message: 'A data não pode estar no futuro.',
    }),
  state: z.string().trim().toUpperCase().refine(isUf, { message: 'UF inválida.' }),
  cities: z
    .array(z.string().trim().min(2, { message: 'Cidade inválida.' }).max(255))
    .max(FLYER_MAX_CITIES, { message: `Máximo de ${FLYER_MAX_CITIES} cidades.` })
    .default([]),
  items: z
    .array(flyerItemSchema)
    .min(1, { message: 'Selecione ao menos um item.' })
    .max(FLYER_MAX_ITEMS_PER_SAVE, { message: `Máximo de ${FLYER_MAX_ITEMS_PER_SAVE} itens.` }),
});

export type FlyerReadInput = z.infer<typeof flyerReadSchema>;
export type FlyerItemInput = z.infer<typeof flyerItemSchema>;
export type FlyerObservationsInput = z.infer<typeof flyerObservationsSchema>;
