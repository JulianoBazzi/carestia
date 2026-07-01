import { z } from 'zod';
import { zoptional, zrequired } from '~/schemas/lib';

export const companySchema = z.object({
  document: zoptional(),
  social_name: zrequired(),
  fantasy_name: zoptional(),
  street: zoptional(),
  number: zoptional(),
  neighborhood: zoptional(),
  city: zoptional(),
  state: zoptional(),
  zipcode: zoptional(),
});

export type CompanyData = z.infer<typeof companySchema>;
export type CompanyFormInput = z.input<typeof companySchema>;
