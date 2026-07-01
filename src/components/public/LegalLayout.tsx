import { Box, Heading, Stack, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { PublicHeader } from '~/components/public/PublicHeader';

/** Layout das páginas legais públicas (Termos, Privacidade). */
export function LegalLayout({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <Box minH="100dvh" bg="bg.app">
      <PublicHeader />
      <Box bg="bg.surface" borderBottomWidth="1px" px={{ base: 4, md: 8 }} py={{ base: 8, md: 10 }}>
        <Stack maxW="3xl" mx="auto" gap="1">
          <Heading size="2xl" fontFamily="heading">
            {title}
          </Heading>
          <Text fontSize="sm" color="fg.muted">
            Atualizado em {updatedAt}
          </Text>
        </Stack>
      </Box>
      <Box px={{ base: 4, md: 8 }} py={{ base: 8, md: 12 }}>
        <Stack maxW="3xl" mx="auto" gap="6">
          {children}
        </Stack>
      </Box>
    </Box>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap="2">
      <Heading size="md" fontFamily="heading">
        {title}
      </Heading>
      <Text color="fg.muted" lineHeight="1.7">
        {children}
      </Text>
    </Stack>
  );
}
