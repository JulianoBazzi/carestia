import { Box, Button, Circle, Link as CLink, Flex, Heading, HStack } from '@chakra-ui/react';
import NextLink from 'next/link';
import { LuTrendingUp } from 'react-icons/lu';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';

/** Cabeçalho das páginas públicas (Início, Termos, Privacidade). */
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
                Minha Inflação
              </Heading>
            </HStack>
          </NextLink>
        </CLink>
        <HStack gap={2}>
          <Button asChild variant="ghost" size="sm">
            <NextLink href="/login">Entrar</NextLink>
          </Button>
          <PrimaryButton size="sm" asChild>
            <NextLink href="/register">Criar conta</NextLink>
          </PrimaryButton>
        </HStack>
      </Flex>
    </Box>
  );
}
