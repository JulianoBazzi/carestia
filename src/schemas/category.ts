import { z } from 'zod';
import { CATEGORY_COLORS, CATEGORY_ICON_KEYS } from '~/lib/category-icons';
import { zrequired } from '~/schemas/lib';

export const categorySchema = z.object({
  name: zrequired(),
  active: z.boolean(),
  icon: z.enum(CATEGORY_ICON_KEYS).nullish(),
  color: z.enum(CATEGORY_COLORS).nullish(),
});

export type CategoryData = z.infer<typeof categorySchema>;
