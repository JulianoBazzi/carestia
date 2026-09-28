'use client';

import { Stack, Text } from '@chakra-ui/react';
import NextLink from 'next/link';
import { AuthShell } from '~/components/auth/AuthShell';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';

/** Beta fechado: explica antes de o visitante preencher o formulário à toa. */
export function RegistrationClosed() {
  return (
    <AuthShell
      title="Cadastro fechado"
      subtitle="A Carestia está em beta fechado"
      brandHeadline="Descubra a sua inflação real"
      brandSubtitle="Importe suas NF-e, NFC-e e NFS-e e compare seus gastos com o IPCA oficial."
    >
      <Stack gap={4}>
        <Text color="fg.muted">
          No momento não estamos aceitando novos cadastros. Enquanto isso, a consulta de preços e o
          scanner de código de barras continuam abertos a todos.
        </Text>
        <PrimaryButton asChild w="full">
          <NextLink href="/login">Já tenho conta — entrar</NextLink>
        </PrimaryButton>
      </Stack>
    </AuthShell>
  );
}
