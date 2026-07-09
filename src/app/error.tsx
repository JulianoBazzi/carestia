'use client';

import { Button, Heading, Stack, Text } from '@chakra-ui/react';
import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Stack minH="60vh" align="center" justify="center" gap="4" textAlign="center" px="4">
      <Heading size="lg" fontFamily="heading">
        Algo deu errado
      </Heading>
      <Text color="fg.muted" maxW="md">
        Ocorreu um erro inesperado. Você pode tentar novamente.
      </Text>
      <Button colorPalette="teal" onClick={reset}>
        Tentar novamente
      </Button>
    </Stack>
  );
}
