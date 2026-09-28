import { z } from 'zod';
import { isUf } from '~/lib/ufs';
import { zulid } from '~/schemas/lib';

/** Teto por linha: acima disso é erro de digitação (vírgula/ponto trocados). */
export const MAX_UNIT_VALUE = 1_000_000;
/** Teto de linhas por nota na entrada manual. */
export const MAX_INVOICE_ITEMS = 500;

/** Texto opcional: vazio/nulo vira `null`. */
const zopt = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: `Máximo de ${max} caracteres.` })
    .nullish()
    .transform((v) => (v ? v : null));

/**
 * Data de emissão. O formulário manda só `yyyy-mm-dd`: fixamos meio-dia em
 * Brasília para nenhum arredondamento de fuso empurrar a nota para o dia (ou o
 * mês) vizinho — `new Date('2026-07-01')` seria 30/06 21h em BRT.
 */
const zissuedAt = z
  .string({ message: 'Informe a data de emissão.' })
  .trim()
  .transform((v, ctx) => {
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00-03:00` : v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Data de emissão inválida.' });
      return z.NEVER;
    }
    return d;
  });

export const invoiceItemInputSchema = z.object({
  /** Id da linha existente (edição): preserva o item casado quando nada mudou. */
  id: z.string().max(26).nullish(),
  description: z
    .string()
    .trim()
    .min(1, { message: 'Informe a descrição do item.' })
    .max(255, { message: 'Descrição com no máximo 255 caracteres.' }),
  reference_code: z
    .string()
    .trim()
    .max(20, { message: 'Código com no máximo 20 caracteres.' })
    .nullish()
    .transform((v) => v ?? ''),
  unit: zopt(10),
  unit_value: z.coerce
    .number({ message: 'Preço unitário inválido.' })
    .positive({ message: 'O preço unitário deve ser maior que zero.' })
    .lte(MAX_UNIT_VALUE, { message: 'Preço unitário fora do limite.' }),
});

// Linhas em branco (sem descrição) que o formulário deixa para trás são
// descartadas antes da validação — mesmo comportamento de antes.
const zitems = z.preprocess(
  (v) =>
    Array.isArray(v)
      ? v.filter(
          (it) =>
            typeof (it as { description?: unknown })?.description === 'string' &&
            (it as { description: string }).description.trim(),
        )
      : [],
  z
    .array(invoiceItemInputSchema)
    .max(MAX_INVOICE_ITEMS, { message: `No máximo ${MAX_INVOICE_ITEMS} itens por nota.` }),
);

export const invoiceWriteSchema = z.object({
  model: z.enum(['nfe', 'nfce', 'nfse', 'nf3e'], { message: 'Modelo inválido.' }),
  number: z
    .string({ message: 'Informe o número.' })
    .trim()
    .min(1, { message: 'Informe o número.' })
    .max(20, { message: 'Número com no máximo 20 caracteres.' }),
  series: zopt(10),
  issued_at: zissuedAt,
  neighborhood: zopt(255),
  city: zopt(255),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .nullish()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || isUf(v), { message: 'UF inválida.' }),
  items: zitems,
});

export const invoiceCreateSchema = invoiceWriteSchema.extend({
  company_id: zulid(),
  access_key: zopt(64),
});

export type InvoiceWriteBody = z.infer<typeof invoiceWriteSchema>;

/** Linhas validadas → entrada do serviço (`queries.ts`). */
export function toItemInputs(items: InvoiceWriteBody['items']) {
  return items.map((it) => ({
    lineId: it.id ?? null,
    description: it.description,
    referenceCode: it.reference_code,
    unit: it.unit,
    unitValue: it.unit_value,
  }));
}
