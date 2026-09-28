'use client';

import { Circle } from '@chakra-ui/react';
import type { IconType } from 'react-icons';
import {
  LuApple,
  LuBeef,
  LuBox,
  LuCar,
  LuCroissant,
  LuCupSoda,
  LuDroplets,
  LuFuel,
  LuGamepad2,
  LuGraduationCap,
  LuHouse,
  LuMilk,
  LuPawPrint,
  LuPill,
  LuShirt,
  LuShoppingBasket,
  LuShowerHead,
  LuSmartphone,
  LuSnowflake,
  LuSofa,
  LuSprayCan,
  LuStethoscope,
  LuStore,
  LuUtensils,
  LuWine,
  LuWrench,
  LuZap,
} from 'react-icons/lu';
import {
  type CategoryIconKey,
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
  isCategoryColor,
  isCategoryIconKey,
} from '~/lib/category-icons';

/**
 * Mapa estático chave → componente. `react-icons` não permite lookup dinâmico
 * por nome sem importar o barrel inteiro, por isso o registry é explícito.
 */
export const CATEGORY_ICONS: Record<CategoryIconKey, IconType> = {
  apple: LuApple,
  beef: LuBeef,
  milk: LuMilk,
  croissant: LuCroissant,
  snowflake: LuSnowflake,
  cup: LuCupSoda,
  wine: LuWine,
  store: LuStore,
  basket: LuShoppingBasket,
  spray: LuSprayCan,
  shower: LuShowerHead,
  droplets: LuDroplets,
  pill: LuPill,
  stethoscope: LuStethoscope,
  paw: LuPawPrint,
  utensils: LuUtensils,
  fuel: LuFuel,
  wrench: LuWrench,
  zap: LuZap,
  house: LuHouse,
  car: LuCar,
  graduation: LuGraduationCap,
  phone: LuSmartphone,
  shirt: LuShirt,
  sofa: LuSofa,
  gamepad: LuGamepad2,
  box: LuBox,
};

interface CategoryIconProps {
  /** Chave do registry; valor desconhecido ou nulo cai no ícone padrão. */
  icon?: string | null;
  /** colorPalette do Chakra; valor desconhecido ou nulo cai no cinza. */
  color?: string | null;
  /** Tamanho do círculo (token do Chakra). */
  size?: string;
  /** Tamanho do glifo em px. */
  iconSize?: number;
}

/**
 * Círculo colorido com o ícone da categoria. Fonte única de renderização —
 * use em tabelas, selects e no dashboard para o visual ficar consistente.
 */
export function CategoryIcon({ icon, color, size = '8', iconSize = 15 }: CategoryIconProps) {
  const Icon = CATEGORY_ICONS[isCategoryIconKey(icon) ? icon : DEFAULT_CATEGORY_ICON];
  const palette = isCategoryColor(color) ? color : DEFAULT_CATEGORY_COLOR;

  return (
    <Circle
      size={size}
      colorPalette={palette}
      bg="colorPalette.subtle"
      color="colorPalette.fg"
      flexShrink={0}
    >
      <Icon size={iconSize} />
    </Circle>
  );
}
