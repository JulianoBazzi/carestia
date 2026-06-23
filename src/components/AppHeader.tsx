import { Link as CLink, Flex, Heading, HStack } from '@chakra-ui/react';
import NextLink from 'next/link';
import { LogoutButton } from '~/components/LogoutButton';
import { ColorModeButton } from '~/components/ui/color-mode';

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/invoices', label: 'Notas' },
  { href: '/inflation', label: 'Inflação' },
  { href: '/items', label: 'Itens' },
];

export function AppHeader() {
  return (
    <Flex as="header" justify="space-between" align="center" py={4} mb={6} gap={4} wrap="wrap">
      <HStack gap={6}>
        <Heading size="md">Minha Inflação</Heading>
        <HStack gap={4} as="nav">
          {links.map((l) => (
            <CLink key={l.href} asChild fontSize="sm" color="fg.muted">
              <NextLink href={l.href}>{l.label}</NextLink>
            </CLink>
          ))}
        </HStack>
      </HStack>
      <HStack gap={2}>
        <ColorModeButton />
        <LogoutButton />
      </HStack>
    </Flex>
  );
}
