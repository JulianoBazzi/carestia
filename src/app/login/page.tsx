'use client';

import { Box, Button, Card, Link as CLink, Heading, Input, Stack, Text } from '@chakra-ui/react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.get('email'),
        password: form.get('password'),
      }),
    });
    setLoading(false);
    if (res.ok) {
      router.replace('/');
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Falha ao entrar.');
    }
  }

  return (
    <Box minH="100dvh" display="grid" placeItems="center" p={4}>
      <Card.Root maxW="sm" w="full">
        <Card.Header>
          <Heading size="lg">Entrar</Heading>
          <Text color="fg.muted">Minha Inflação</Text>
        </Card.Header>
        <Card.Body>
          <form onSubmit={onSubmit}>
            <Stack gap={4}>
              <Input name="email" type="email" placeholder="E-mail" required />
              <Input name="password" type="password" placeholder="Senha" required />
              {error && (
                <Text color="red.500" fontSize="sm">
                  {error}
                </Text>
              )}
              <Button type="submit" loading={loading}>
                Entrar
              </Button>
              <Text fontSize="sm" color="fg.muted">
                Não tem conta?{' '}
                <CLink asChild>
                  <NextLink href="/register">Cadastre-se</NextLink>
                </CLink>
              </Text>
            </Stack>
          </form>
        </Card.Body>
      </Card.Root>
    </Box>
  );
}
