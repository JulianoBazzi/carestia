import { Box, Button, Flex, Heading, Stack, Text } from '@chakra-ui/react';
import NextLink from 'next/link';
import { PublicPricesExplorer } from '~/app/components/public-prices-explorer';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import { PublicHeader } from '~/components/public/PublicHeader';
import { Header } from '~/components/Template/Header';
import { isRegistrationOpen } from '~/lib/registration';

interface IPublicHomeProps {
  /** Usuário logado, quando houver: troca o topo e os CTAs de cadastro. */
  user?: { name: string; email: string } | null;
}

/**
 * Índice geral de preços — a mesma tela para todo mundo. O que muda com a sessão
 * é só o entorno: deslogado ganha o topo público e os CTAs de cadastro; logado
 * ganha o menu do app e o atalho de importação.
 */
export function PublicHome({ user }: IPublicHomeProps) {
  // Beta fechado: sem cadastro aberto, o CTA leva ao login.
  const signUp = isRegistrationOpen()
    ? { href: '/register', label: 'Criar conta grátis' }
    : { href: '/login', label: 'Entrar' };

  return (
    <Box minH="100dvh" bg="bg.app" display="flex" flexDirection="column">
      {user ? <Header user={user} mb={0} /> : <PublicHeader />}

      <Box
        bgGradient="to-br"
        gradientFrom="teal.600"
        gradientTo="#0B544D"
        color="white"
        px={{ base: 4, md: 8 }}
        pt={{ base: 10, md: 14 }}
        pb={{ base: 16, md: 20 }}
      >
        <Stack maxW="6xl" mx="auto" gap="5" align="center" textAlign="center">
          <Heading size={{ base: '2xl', md: '3xl' }} fontFamily="heading" maxW="3xl">
            Quanto custa viver na sua cidade?
          </Heading>
          <Text fontSize={{ base: 'md', md: 'lg' }} color="whiteAlpha.800" maxW="2xl">
            Acompanhe a inflação real dos preços do dia a dia — do supermercado à conta de luz — a
            partir de notas fiscais reais, de forma anônima.
          </Text>
        </Stack>
      </Box>

      <Box px={{ base: 4, md: 8 }} pb={{ base: 8, md: 12 }} flex="1">
        {/* Margem negativa: o card de filtros sobe sobre o gradiente, mantendo a
            leitura de "busca dentro do hero". */}
        <Box maxW="6xl" mx="auto" mt={{ base: -10, md: -14 }}>
          <PublicPricesExplorer
            emptyAction={
              user ? (
                <PrimaryButton asChild>
                  <NextLink href="/invoices/import">Importar notas</NextLink>
                </PrimaryButton>
              ) : (
                <PrimaryButton asChild>
                  <NextLink href={signUp.href}>{signUp.label}</NextLink>
                </PrimaryButton>
              )
            }
          />
        </Box>
      </Box>

      <Box bg="bg.sidebar" color="white" px={{ base: 4, md: 8 }} py={{ base: 10, md: 12 }}>
        {user ? (
          <Flex maxW="6xl" mx="auto" gap="4" justify="space-between" align="center" wrap="wrap">
            <Stack gap="1">
              <Heading size="lg" fontFamily="heading">
                Acompanhe a SUA inflação pessoal
              </Heading>
              <Text color="whiteAlpha.700">
                Importe suas notas e compare seus gastos com o IPCA oficial.
              </Text>
            </Stack>
            <PrimaryButton size="lg" asChild>
              <NextLink href="/dashboard">Ver meu Dashboard</NextLink>
            </PrimaryButton>
          </Flex>
        ) : (
          <Flex maxW="6xl" mx="auto" gap="4" justify="space-between" align="center" wrap="wrap">
            <Stack gap="1">
              <Heading size="lg" fontFamily="heading">
                Quer acompanhar a SUA inflação pessoal?
              </Heading>
              <Text color="whiteAlpha.700">
                Importe suas notas e compare seus gastos com o IPCA oficial.
              </Text>
            </Stack>
            <PrimaryButton size="lg" asChild>
              <NextLink href={signUp.href}>{signUp.label}</NextLink>
            </PrimaryButton>
          </Flex>
        )}
        <Flex
          maxW="6xl"
          mx="auto"
          gap="4"
          mt="8"
          pt="6"
          borderTopWidth="1px"
          borderColor="whiteAlpha.300"
        >
          <Button asChild variant="plain" color="whiteAlpha.700" size="sm" px="0">
            <NextLink href="/terms">Termos de Uso</NextLink>
          </Button>
          <Button asChild variant="plain" color="whiteAlpha.700" size="sm" px="0">
            <NextLink href="/privacy">Política de Privacidade</NextLink>
          </Button>
        </Flex>
      </Box>
    </Box>
  );
}
