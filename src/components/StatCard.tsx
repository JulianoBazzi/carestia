'use client';

import { Card, Circle, HStack, Stack, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  helpText?: ReactNode;
  /** Cor do círculo do ícone e (opcionalmente) do valor. */
  colorPalette?: string;
  /** Aplica a cor do palette ao valor (para deltas de preço, p.ex.). */
  accentValue?: boolean;
}

/** Card de métrica reutilizável (cf. cards do topo de Categorias e do Dashboard). */
export function StatCard({
  label,
  value,
  icon,
  helpText,
  colorPalette = 'teal',
  accentValue = false,
}: StatCardProps) {
  return (
    <Card.Root flex="1" minW="0" bg="bg.surface">
      <Card.Body p="4">
        <HStack gap="3" align="center">
          {icon && (
            <Circle
              size="10"
              bg="colorPalette.subtle"
              color="colorPalette.fg"
              colorPalette={colorPalette}
              flexShrink={0}
            >
              {icon}
            </Circle>
          )}
          <Stack gap="0.5" minW="0">
            <Text fontSize="xs" color="fg.muted" fontWeight="medium" truncate>
              {label}
            </Text>
            <Text
              fontSize="2xl"
              fontWeight="bold"
              fontFamily="heading"
              colorPalette={colorPalette}
              color={accentValue ? 'colorPalette.fg' : 'fg'}
              lineHeight="1.1"
            >
              {value}
            </Text>
            {helpText && (
              <Text fontSize="xs" color="fg.muted">
                {helpText}
              </Text>
            )}
          </Stack>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
}
