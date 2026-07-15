import { isValidCNPJ } from '@julianobazzi/utils';
import { z } from 'zod';
import { zoptional, zrequired } from '~/schemas/lib';

export const companySchema = z.object({
  document: zoptional().refine((v) => !v || isValidCNPJ(v), { message: 'CNPJ inválido.' }),
  social_name: zrequired(),
  fantasy_name: zoptional(),
  neighborhood: zoptional(),
  city: zoptional(),
  state: zoptional(),
});

export type CompanyData = z.infer<typeof companySchema>;
export type CompanyFormInput = z.input<typeof companySchema>;
