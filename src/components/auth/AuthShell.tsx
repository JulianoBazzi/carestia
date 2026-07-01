'use client';

import { Box, Card, Circle, Flex, Heading, HStack, Icon, Stack, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { LuCheck, LuTrendingUp } from 'react-icons/lu';
import { ColorModeButton } from '~/components/ui/color-mode';

export interface AuthShellProps {
  /** Título do card de formulário (ex.: "Entrar"). */
  title: string;
  subtitle?: string;
  /** Headline do painel de marca à esquerda. */
  brandHeadline: string;
  brandSubtitle?: string;
  /** Bullets de valor exibidos no painel de marca. */
  bullets?: string[];
  children: ReactNode;
}

function Brand() {
  return (
    <HStack gap={2.5}>
      <Circle size="9" bg="teal.500" color="white">
        <LuTrendingUp size={20} />
      </Circle>
      <Heading size="md" color="white" fontFamily="heading">
        Minha Inflação
      </Heading>
    </HStack>
  );
}

export function AuthShell({
  title,
  subtitle,
  brandHeadline,
  brandSubtitle,
  bullets = [],
  children,
}: AuthShellProps) {
  return (
    <Flex minH="100dvh">
      <Stack
        display={{ base: 'none', lg: 'flex' }}
        w="44%"
        maxW="560px"
        bg="bg.sidebar"
        color="white"
        p={14}
        justify="space-between"
      >
        <Brand />
        <Stack gap={7} maxW="md">
          <Heading size="3xl" fontFamily="heading" lineHeight="1.15">
            {brandHeadline}
          </Heading>
          {brandSubtitle && (
            <Text color="whiteAlpha.700" fontSize="md">
              {brandSubtitle}
            </Text>
          )}
          <Stack gap={3.5} pt={2}>
            {bullets.map((b) => (
              <HStack key={b} gap={3} align="start">
                <Circle size="5" bg="teal.500/20" color="teal.300" mt={0.5} flexShrink={0}>
                  <Icon as={LuCheck} boxSize={3} />
                </Circle>
                <Text color="whiteAlpha.900" fontSize="sm">
                  {b}
                </Text>
              </HStack>
            ))}
          </Stack>
        </Stack>
        <Text fontSize="xs" color="whiteAlpha.500">
          © Minha Inflação
        </Text>
      </Stack>

      <Flex
        flex="1"
        bg="bg.app"
        align="center"
        justify="center"
        p={{ base: 6, md: 10 }}
        position="relative"
      >
        <Box position="absolute" top={4} right={4}>
          <ColorModeButton />
        </Box>

        <Card.Root
          maxW="md"
          w="full"
          bg="bg.surface"
          borderRadius="2xl"
          boxShadow="lg"
          borderWidth="1px"
        >
          <Card.Header pt={8} pb={2}>
            <Stack gap={1}>
              <HStack gap={2} display={{ base: 'flex', lg: 'none' }} mb={2}>
                <Circle size="8" bg="teal.600" color="white">
                  <LuTrendingUp size={18} />
                </Circle>
                <Heading size="sm" fontFamily="heading">
                  Minha Inflação
                </Heading>
              </HStack>
              <Heading size="xl" fontFamily="heading">
                {title}
              </Heading>
              {subtitle && (
                <Text color="fg.muted" fontSize="sm">
                  {subtitle}
                </Text>
              )}
            </Stack>
          </Card.Header>
          <Card.Body pt={5} pb={8}>
            {children}
          </Card.Body>
        </Card.Root>
      </Flex>
    </Flex>
  );
}
