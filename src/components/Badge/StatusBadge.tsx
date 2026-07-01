'use client';

import { Badge, type BadgeProps, Circle } from '@chakra-ui/react';

export type StatusBadgeProps = BadgeProps & {
  label: string;
  /** Mostra um ponto colorido antes do texto (cf. componente Badge do design). */
  withDot?: boolean;
};

/**
 * Badge de status reutilizável (Ativo/Inativo, tipo de nota, tipo de item).
 * Espelha o componente `Badge` do design: pílula com ponto + rótulo, colorida
 * via `colorPalette` do Chakra.
 */
export function StatusBadge({
  label,
  withDot = true,
  colorPalette = 'teal',
  ...rest
}: StatusBadgeProps) {
  return (
    <Badge
      colorPalette={colorPalette}
      variant="subtle"
      borderRadius="full"
      px="2.5"
      py="1"
      gap="1.5"
      fontWeight="semibold"
      {...rest}
    >
      {withDot && <Circle size="1.5" bg="colorPalette.solid" />}
      {label}
    </Badge>
  );
}
