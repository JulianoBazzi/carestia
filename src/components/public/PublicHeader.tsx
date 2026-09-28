import { Box, Button, Circle, Link as CLink, Flex, Heading, HStack } from '@chakra-ui/react';
import NextLink from 'next/link';
import { LuScanLine, LuTrendingUp } from 'react-icons/lu';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import { isRegistrationOpen } from '~/lib/registration';

/** Cabeçalho das páginas públicas (Início, Scanner, Termos, Privacidade). */
export function PublicHeader() {
  return (
    <Box
      as="header"
      position="sticky"
      top={0}
      zIndex="docked"
      bg="bg.surface"
      borderBottomWidth="1px"
    >
      <Flex
        maxW="6xl"
        mx="auto"
        px={{ base: 4, md: 8 }}
        py={3}
        justify="space-between"
        align="center"
      >
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
        <HStack gap={{ base: 1, md: 2 }}>
          <Button asChild variant="ghost" size="sm">
            <NextLink href="/scanner">
              <LuScanLine /> Scanner
            </NextLink>
          </Button>
          {isRegistrationOpen() ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <NextLink href="/login">Entrar</NextLink>
              </Button>
              <PrimaryButton size="sm" asChild>
                <NextLink href="/register">Criar conta</NextLink>
              </PrimaryButton>
            </>
          ) : (
            <PrimaryButton size="sm" asChild>
              <NextLink href="/login">Entrar</NextLink>
            </PrimaryButton>
          )}
        </HStack>
      </Flex>
    </Box>
  );
}
