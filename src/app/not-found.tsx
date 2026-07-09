import { Button, Heading, Stack, Text } from '@chakra-ui/react';
import NextLink from 'next/link';

export default function NotFound() {
  return (
    <Stack minH="60vh" align="center" justify="center" gap="4" textAlign="center" px="4">
      <Heading size="2xl" fontFamily="heading" color="teal.600">
        404
      </Heading>
      <Text color="fg.muted">A página que você procura não foi encontrada.</Text>
      <Button asChild colorPalette="teal">
        <NextLink href="/">Voltar ao início</NextLink>
      </Button>
    </Stack>
  );
}
