'use client';

import {
  Card,
  Flex,
  Heading,
  HStack,
  Skeleton,
  SkeletonCircle,
  Stack,
  Text,
} from '@chakra-ui/react';
import NextLink from 'next/link';
import { LuUpload } from 'react-icons/lu';
import { AdSlot } from '~/components/Ad/AdSlot';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';

/** Cabeçalho estático do dashboard — renderizado tanto no loading quanto com dados. */
export function DashboardHeader() {
  return (
    <Flex justify="space-between" align="center" gap="4" wrap="wrap">
      <Stack gap="0.5">
        <Heading size="lg" fontFamily="heading">
          Dashboard
        </Heading>
        <Text fontSize="sm" color="fg.muted">
          Sua inflação real comparada ao IPCA oficial.
        </Text>
      </Stack>
      <PrimaryButton size="sm" asChild>
        <NextLink href="/invoices/import">
          <LuUpload /> Importar XML
        </NextLink>
      </PrimaryButton>
    </Flex>
  );
}

function StatCardSkeleton() {
  return (
    <Card.Root flex="1" minW="0" bg="bg.surface">
      <Card.Body p="4">
        <HStack gap="3" align="center">
          <SkeletonCircle size="10" flexShrink={0} />
          <Stack gap="1.5" minW="0" flex="1">
            <Skeleton h="3" w="20" />
            <Skeleton h="7" w="16" />
          </Stack>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
}

function TableCardSkeleton({ rows }: { rows: number }) {
  return (
    <Card.Root bg="bg.surface">
      <Card.Body>
        <Stack gap="4">
          <Skeleton h="5" w="56" />
          <Stack gap="3">
            {Array.from({ length: rows }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeletons estáticos
              <Skeleton key={i} h="4" w="full" />
            ))}
          </Stack>
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}

/** Espelha o layout do DashboardCard enquanto os dados de inflação carregam. */
export function DashboardSkeleton() {
  return (
    <Stack gap="6">
      <DashboardHeader />

      <AdSlot variant="banner" />

      <Flex gap="4" wrap="wrap">
        {Array.from({ length: 4 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeletons estáticos
          <StatCardSkeleton key={i} />
        ))}
      </Flex>

      <Flex gap="5" align="start">
        <Stack flex="1" minW="0" gap="5">
          <Card.Root bg="bg.surface">
            <Card.Body>
              <Stack gap="3">
                <Skeleton h="5" w="56" />
                <Skeleton h="2xs" w="full" />
              </Stack>
            </Card.Body>
          </Card.Root>

          <TableCardSkeleton rows={4} />
          <TableCardSkeleton rows={5} />
        </Stack>
        <Stack display={{ base: 'none', xl: 'flex' }} gap="4">
          <AdSlot variant="vertical" />
          <AdSlot variant="square" />
        </Stack>
      </Flex>
    </Stack>
  );
}
