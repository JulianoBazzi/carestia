'use client';

import { Box, Circle, Link as CLink, Flex, Heading, HStack } from '@chakra-ui/react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import type { IconType } from 'react-icons';
import {
  LuBuilding2,
  LuFolderTree,
  LuLayoutDashboard,
  LuReceipt,
  LuTags,
  LuTrendingUp,
} from 'react-icons/lu';
import { LogoutButton } from '~/components/LogoutButton';
import { ColorModeButton } from '~/components/ui/color-mode';

const links: { href: string; label: string; icon: IconType }[] = [
  { href: '/', label: 'Dashboard', icon: LuLayoutDashboard },
  { href: '/invoices', label: 'Notas', icon: LuReceipt },
  { href: '/inflation', label: 'Inflação', icon: LuTrendingUp },
  { href: '/items', label: 'Itens', icon: LuTags },
  { href: '/categories', label: 'Categorias', icon: LuFolderTree },
  { href: '/companies', label: 'Empresas', icon: LuBuilding2 },
];

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function Header() {
  const pathname = usePathname();

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
        px={{ base: 4, md: 6 }}
        py={3}
        justify="space-between"
        align="center"
        gap={4}
        wrap="wrap"
      >
        <HStack gap={{ base: 4, md: 8 }} wrap="wrap">
          <CLink asChild _hover={{ textDecoration: 'none' }}>
            <NextLink href="/">
              <HStack gap={2}>
                <Circle size="9" bg="teal.500" color="white">
                  <LuTrendingUp size={18} />
                </Circle>
                <Heading size="md">Minha Inflação</Heading>
              </HStack>
            </NextLink>
          </CLink>
          <HStack gap={1} as="nav">
            {links.map((l) => {
              const active = isActive(pathname, l.href);
              return (
                <CLink
                  key={l.href}
                  asChild
                  fontSize="sm"
                  px={3}
                  py={1.5}
                  borderRadius="md"
                  fontWeight={active ? 'semibold' : 'medium'}
                  color={active ? 'teal.600' : 'fg.muted'}
                  bg={active ? { base: 'teal.50', _dark: 'teal.950' } : 'transparent'}
                  _hover={{ textDecoration: 'none', color: 'teal.600' }}
                >
                  <NextLink href={l.href}>
                    <HStack gap={1.5}>
                      <l.icon size={16} />
                      <span>{l.label}</span>
                    </HStack>
                  </NextLink>
                </CLink>
              );
            })}
          </HStack>
        </HStack>
        <HStack gap={2}>
          <ColorModeButton />
          <LogoutButton />
        </HStack>
      </Flex>
    </Box>
  );
}
