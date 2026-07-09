import { Spinner, Stack, Text } from '@chakra-ui/react';

export interface LoadingStateProps {
  label?: string;
  /** Espaçamento vertical; use "sm" dentro de cards e "lg" em páginas inteiras. */
  size?: 'sm' | 'lg';
}

/** Estado de carregamento reutilizável — padroniza os `<Spinner>` soltos. */
export function LoadingState({ label = 'Carregando…', size = 'lg' }: LoadingStateProps) {
  return (
    <Stack align="center" gap="3" py={size === 'lg' ? '20' : '8'}>
      <Spinner color="teal.500" />
      {label && (
        <Text fontSize="sm" color="fg.muted">
          {label}
        </Text>
      )}
    </Stack>
  );
}
