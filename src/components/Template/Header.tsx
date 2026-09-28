'use client';

import { Box, Circle, Link as CLink, Flex, Heading, HStack } from '@chakra-ui/react';
import { useActiveRoute } from '@julianobazzi/nextjs-utils/next';
import NextLink from 'next/link';
import type { IconType } from 'react-icons';
import {
  LuBuilding2,
  LuFolderTree,
  LuGlobe,
  LuLayoutDashboard,
  LuReceipt,
  LuScanLine,
  LuTags,
  LuTrendingUp,
} from 'react-icons/lu';
import { UserMenu } from '~/components/Template/UserMenu';

interface INavItem {
  href: string;
  label: string;
  icon: IconType;
  /** Casa só o path exato. Obrigatório em `/`, que é prefixo de todas as rotas. */
  exact?: boolean;
}

const links: INavItem[] = [
  { href: '/', label: 'Índice Geral', icon: LuGlobe, exact: true },
  { href: '/scanner', label: 'Scanner', icon: LuScanLine },
  { href: '/dashboard', label: 'Dashboard', icon: LuLayoutDashboard, exact: true },
  { href: '/invoices', label: 'Notas Fiscais', icon: LuReceipt },
  { href: '/categories', label: 'Categorias', icon: LuFolderTree },
  { href: '/companies', label: 'Empresas', icon: LuBuilding2 },
  { href: '/items', label: 'Itens', icon: LuTags },
];

function NavLink({ href, label, icon: Icon, exact }: INavItem) {
  // Sem `exact`, a aba fica ativa também nas sub-rotas (ex.: /invoices/import).
  const active = useActiveRoute(href, { exact });
  return (
    <CLink
      asChild
      fontSize="sm"
      px={3}
      py={2}
      borderRadius="lg"
      fontWeight={active ? 'semibold' : 'medium'}
      color={active ? 'teal.700' : 'fg.muted'}
      bg={active ? { base: 'teal.50', _dark: 'teal.950' } : 'transparent'}
      _hover={{ textDecoration: 'none', color: 'teal.700' }}
    >
      <NextLink href={href}>
        <HStack gap={1.5}>
          <Icon size={16} />
          <span>{label}</span>
        </HStack>
      </NextLink>
    </CLink>
  );
}

export function Header({
  user,
  mb = 6,
}: {
  user: { name: string; email: string };
  /** A home usa 0: o hero em gradiente encosta direto no header. */
  mb?: number;
}) {
  return (
    <Box
      as="header"
      position="sticky"
      top={0}
      zIndex="docked"
      mb={mb}
      borderBottomWidth="1px"
      bg={{ base: 'whiteAlpha.800', _dark: 'blackAlpha.700' }}
      backdropFilter="blur(8px)"
    >
      <Flex
        maxW="full"
        px={{ base: 4, md: 7 }}
        py={2.5}
        justify="space-between"
        align="center"
        gap={4}
        wrap="wrap"
      >
        <HStack gap={{ base: 4, md: 8 }} wrap="wrap">
          <CLink asChild _hover={{ textDecoration: 'none' }}>
            <NextLink href="/">
              <HStack gap={2}>
                <Circle size="8" bg="teal.600" color="white">
                  <LuTrendingUp size={18} />
                </Circle>
                <Heading size="md" fontFamily="heading">
                  Carestia
                </Heading>
              </HStack>
            </NextLink>
          </CLink>
          <HStack gap={1} as="nav">
            {links.map((l) => (
              <NavLink key={l.href} {...l} />
            ))}
          </HStack>
        </HStack>
        <HStack gap={2}>
          <UserMenu name={user.name} email={user.email} />
        </HStack>
      </Flex>
    </Box>
  );
}
