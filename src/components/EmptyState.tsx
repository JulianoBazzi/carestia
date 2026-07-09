import { Circle, Icon, Stack, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  /** Ícone (ex.: um `react-icons`), renderizado dentro de um círculo neutro. */
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  /** Ação opcional (ex.: um botão para criar o primeiro registro). */
  action?: ReactNode;
}

/** Estado vazio reutilizável — padroniza os "Nenhum registro" espalhados pelo app. */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Stack align="center" textAlign="center" gap="3" py="10" px="4">
      {icon && (
        <Circle size="12" bg="bg.muted" color="fg.muted">
          <Icon boxSize="6">{icon}</Icon>
        </Circle>
      )}
      <Stack gap="1" align="center">
        <Text fontWeight="semibold">{title}</Text>
        {description && (
          <Text fontSize="sm" color="fg.muted" maxW="sm">
            {description}
          </Text>
        )}
      </Stack>
      {action}
    </Stack>
  );
}
