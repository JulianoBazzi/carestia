import { z } from 'zod';
import { zrequired } from '~/schemas/lib';

export const categorySchema = z.object({
  name: zrequired(),
});

export type CategoryData = z.infer<typeof categorySchema>;
