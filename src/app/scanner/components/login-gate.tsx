'use client';

import { Button, Card, HStack, Icon, Stack, Text } from '@chakra-ui/react';
import NextLink from 'next/link';
import type { ReactNode } from 'react';
import { LuLogIn, LuTriangleAlert } from 'react-icons/lu';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';

/** Aviso de "entre para usar" das abas do scanner que dependem de conta. */
export function LoginGate({
  tab,
  registrationOpen,
  children,
}: {
  tab: string;
  registrationOpen: boolean;
  children: ReactNode;
}) {
  const next = encodeURIComponent(`/scanner?tab=${tab}`);
  return (
    <Card.Root bg="bg.surface">
      <Card.Body>
        <Stack gap="4" align="start">
          <Text fontSize="sm" color="fg.muted">
            {children}
          </Text>
          <HStack gap="2" wrap="wrap">
            <PrimaryButton size="sm" asChild>
              <NextLink href={`/login?next=${next}`}>
                <LuLogIn /> Entrar
              </NextLink>
            </PrimaryButton>
            {registrationOpen && (
              <Button size="sm" variant="ghost" asChild>
                <NextLink href="/register">Criar conta</NextLink>
              </Button>
            )}
          </HStack>
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}

/** Aviso de recurso desligado no servidor (integração sem chave configurada). */
export function FeatureUnavailable({ children }: { children: ReactNode }) {
  return (
    <Card.Root bg="orange.50" borderColor="orange.200" _dark={{ bg: 'orange.950' }}>
      <Card.Body>
        <HStack gap="3" align="start">
          <Icon as={LuTriangleAlert} color="orange.500" boxSize={5} mt={0.5} />
          <Text fontSize="sm" color="fg.muted">
            {children}
          </Text>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
}
