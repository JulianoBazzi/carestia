import { isValidCNPJ } from '@julianobazzi/utils';
import { z } from 'zod';
import { isUf } from '~/lib/ufs';
import { zoptional, zrequired } from '~/schemas/lib';

export const companySchema = z.object({
  document: zoptional().refine((v) => !v || isValidCNPJ(v), { message: 'CNPJ inválido.' }),
  social_name: zrequired(),
  fantasy_name: zoptional(),
  neighborhood: zoptional(),
  city: zoptional(),
  state: zoptional(2).refine((v) => !v || isUf(v.toUpperCase()), { message: 'UF inválida.' }),
});

/** Edição: o documento (CNPJ) não muda; os demais campos são opcionais. */
export const companyUpdateSchema = companySchema
  .omit({ document: true })
  .partial()
  .extend({ social_name: zrequired() });

export type CompanyData = z.infer<typeof companySchema>;
export type CompanyFormInput = z.input<typeof companySchema>;
