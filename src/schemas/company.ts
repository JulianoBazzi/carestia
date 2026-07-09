import { isValidCNPJ, isValidPostalCode } from '@julianobazzi/utils';
import { z } from 'zod';
import { zoptional, zrequired } from '~/schemas/lib';

export const companySchema = z.object({
  document: zoptional().refine((v) => !v || isValidCNPJ(v), { message: 'CNPJ inválido.' }),
  social_name: zrequired(),
  fantasy_name: zoptional(),
  street: zoptional(),
  number: zoptional(),
  neighborhood: zoptional(),
  city: zoptional(),
  state: zoptional(),
  zipcode: zoptional().refine((v) => !v || isValidPostalCode(v), { message: 'CEP inválido.' }),
});

export type CompanyData = z.infer<typeof companySchema>;
export type CompanyFormInput = z.input<typeof companySchema>;
