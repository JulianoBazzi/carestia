/**
 * Identidade visual das categorias: chaves de ícone e paletas permitidas.
 *
 * Este módulo é PURO de propósito (sem `react-icons`) porque é importado pelos
 * schemas Zod e, por tabela, pelas rotas de API. O mapa chave → componente vive
 * em `~/components/CategoryIcon`.
 */

export const CATEGORY_ICON_KEYS = [
  'apple',
  'beef',
  'milk',
  'croissant',
  'snowflake',
  'cup',
  'wine',
  'store',
  'basket',
  'spray',
  'shower',
  'droplets',
  'pill',
  'stethoscope',
  'paw',
  'utensils',
  'fuel',
  'wrench',
  'zap',
  'house',
  'car',
  'graduation',
  'phone',
  'shirt',
  'sofa',
  'gamepad',
  'box',
] as const;

export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number];

export const CATEGORY_COLORS = [
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'cyan',
  'blue',
  'purple',
  'pink',
  'gray',
] as const;

export type CategoryColor = (typeof CATEGORY_COLORS)[number];

export const DEFAULT_CATEGORY_ICON: CategoryIconKey = 'box';
export const DEFAULT_CATEGORY_COLOR: CategoryColor = 'gray';

export function isCategoryIconKey(value: unknown): value is CategoryIconKey {
  return CATEGORY_ICON_KEYS.includes(value as CategoryIconKey);
}

export function isCategoryColor(value: unknown): value is CategoryColor {
  return CATEGORY_COLORS.includes(value as CategoryColor);
}
