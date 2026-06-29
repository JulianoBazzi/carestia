'use client';

import { Box, Card, Circle, Heading, Stack, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { LuTrendingUp } from 'react-icons/lu';
import { ColorModeButton } from '~/components/ui/color-mode';

export interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <Box
      minH="100dvh"
      display="grid"
      placeItems="center"
      p={4}
      position="relative"
      bgGradient="to-br"
      gradientFrom={{ base: 'teal.50', _dark: 'gray.950' }}
      gradientVia={{ base: 'blue.50', _dark: 'gray.900' }}
      gradientTo={{ base: 'purple.50', _dark: 'teal.950' }}
    >
      <Box position="absolute" top={4} right={4}>
        <ColorModeButton />
      </Box>

      <Card.Root
        maxW="sm"
        w="full"
        borderRadius="2xl"
        boxShadow="2xl"
        borderWidth="1px"
        overflow="hidden"
      >
        <Card.Header pt={8} pb={2}>
          <Stack align="center" gap={3} textAlign="center">
            <Circle size="14" bg="teal.500" color="white" boxShadow="md">
              <LuTrendingUp size={28} />
            </Circle>
            <Stack gap={0}>
              <Text fontSize="sm" fontWeight="medium" color="teal.500" letterSpacing="wide">
                Minha Inflação
              </Text>
              <Heading size="lg">{title}</Heading>
              {subtitle && (
                <Text color="fg.muted" fontSize="sm">
                  {subtitle}
                </Text>
              )}
            </Stack>
          </Stack>
        </Card.Header>
        <Card.Body pt={4} pb={8}>
          {children}
        </Card.Body>
      </Card.Root>
    </Box>
  );
}
