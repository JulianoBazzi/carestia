'use client';

import { HStack, Text } from '@chakra-ui/react';
import { CategoryIcon } from '~/components/CategoryIcon';
import type ICategoryAPI from '~/models/Entity/Category/ICategoryAPI';
import type ISelectOption from '~/models/ISelectOption';

/** Converte categorias da API em opções de `Select` já com ícone e cor. */
export function toCategoryOptions(categories: ICategoryAPI[]): ISelectOption[] {
  return categories.map((category) => ({
    value: category.id,
    label: category.name,
    icon: category.icon,
    color: category.color,
  }));
}

/** Passe em `formatOptionLabel` do `Select` para mostrar o ícone da categoria. */
export function formatCategoryOption(option: ISelectOption) {
  return (
    <HStack gap="2">
      <CategoryIcon icon={option.icon} color={option.color} size="5" iconSize={11} />
      <Text truncate>{option.label}</Text>
    </HStack>
  );
}
