'use client';

import { Box, Circle, Link as CLink, Flex, Heading, HStack } from '@chakra-ui/react';
import { useActiveRoute } from '@julianobazzi/nextjs-utils/next';
import NextLink from 'next/link';
import type { IconType } from 'react-icons';
import {
  LuBuilding2,
  LuFolderTree,
  LuLayoutDashboard,
  LuReceipt,
  LuTags,
  LuTrendingUp,
} from 'react-icons/lu';
import { UserMenu } from '~/components/Template/UserMenu';

const links: { href: string; label: string; icon: IconType }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LuLayoutDashboard },
  { href: '/invoices', label: 'Notas Fiscais', icon: LuReceipt },
  { href: '/categories', label: 'Categorias', icon: LuFolderTree },
  { href: '/companies', label: 'Empresas', icon: LuBuilding2 },
  { href: '/items', label: 'Itens', icon: LuTags },
];

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: IconType }) {
  // Dashboard casa exato; demais abas ficam ativas também nas sub-rotas (ex.: /invoices/import).
  const active = useActiveRoute(href, { exact: href === '/dashboard' });
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

export function Header({ user }: { user: { name: string; email: string } }) {
  return (
    <Box
      as="header"
      position="sticky"
      top={0}
      zIndex="docked"
      mb={6}
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
            <NextLink href="/dashboard">
              <HStack gap={2}>
                <Circle size="8" bg="teal.600" color="white">
                  <LuTrendingUp size={18} />
                </Circle>
                <Heading size="md" fontFamily="heading">
                  Minha Inflação
                </Heading>
              </HStack>
            </NextLink>
          </CLink>
          <HStack gap={1} as="nav">
            {links.map((l) => (
              <NavLink key={l.href} href={l.href} label={l.label} icon={l.icon} />
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
