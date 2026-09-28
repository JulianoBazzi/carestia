export interface IDefaultCategory {
  name: string;
  slug: string;
  /** Chave do registry em `~/lib/category-icons`. */
  icon: string;
  /** colorPalette do Chakra (ver `CATEGORY_COLORS`). */
  color: string;
}

export const DEFAULT_CATEGORIES: IDefaultCategory[] = [
  // Mercado (granulares) — preferidas na categorização de produtos.
  { name: 'HORTIFRUTI', slug: 'produce', icon: 'apple', color: 'green' },
  { name: 'CARNES', slug: 'meat', icon: 'beef', color: 'red' },
  { name: 'LATICINIOS', slug: 'dairy', icon: 'milk', color: 'yellow' },
  { name: 'PADARIA', slug: 'bakery', icon: 'croissant', color: 'orange' },
  { name: 'CONGELADOS', slug: 'frozen', icon: 'snowflake', color: 'cyan' },
  { name: 'BEBIDAS', slug: 'beverages', icon: 'cup', color: 'blue' },
  { name: 'MERCEARIA', slug: 'groceries', icon: 'store', color: 'purple' },
  { name: 'LIMPEZA', slug: 'cleaning', icon: 'spray', color: 'teal' },
  { name: 'HIGIENE', slug: 'hygiene', icon: 'shower', color: 'pink' },
  { name: 'FARMACIA', slug: 'pharmacy', icon: 'pill', color: 'blue' },
  { name: 'PET', slug: 'pet', icon: 'paw', color: 'yellow' },
  // Abrangentes.
  { name: 'ALIMENTACAO', slug: 'food', icon: 'utensils', color: 'orange' },
  { name: 'COMBUSTIVEIS', slug: 'fuel', icon: 'fuel', color: 'orange' },
  { name: 'SERVICOS', slug: 'services', icon: 'wrench', color: 'gray' },
  { name: 'SAUDE', slug: 'health', icon: 'stethoscope', color: 'red' },
  { name: 'ENERGIA', slug: 'energy', icon: 'zap', color: 'purple' },
  { name: 'MORADIA', slug: 'housing', icon: 'house', color: 'teal' },
  { name: 'TRANSPORTE', slug: 'transport', icon: 'car', color: 'blue' },
  { name: 'EDUCACAO', slug: 'education', icon: 'graduation', color: 'cyan' },
  { name: 'COMUNICACAO', slug: 'communication', icon: 'phone', color: 'blue' },
  { name: 'VESTUARIO', slug: 'clothing', icon: 'shirt', color: 'pink' },
  { name: 'CASA', slug: 'household', icon: 'sofa', color: 'purple' },
  { name: 'LAZER', slug: 'leisure', icon: 'gamepad', color: 'green' },
  { name: 'OUTROS', slug: 'other', icon: 'box', color: 'gray' },
];
