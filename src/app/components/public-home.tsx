'use client';

import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  HStack,
  Input,
  NativeSelect,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import NextLink from 'next/link';
import { useState } from 'react';
import { LuSearch, LuZap } from 'react-icons/lu';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import { PublicHeader } from '~/components/public/PublicHeader';
import { formatPrice } from '~/lib/format';
import { api } from '~/services/apiClient';

interface IPublicPrice {
  itemId: string;
  name: string;
  type: 'product' | 'service' | 'energy';
  unit: string | null;
  avgPrice: number;
  samples: number;
  series: number[];
}

function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <HStack gap="1" h="12" align="end">
      {values.map((v, i) => (
        <Box
          // biome-ignore lint/suspicious/noArrayIndexKey: barras posicionais estáticas
          key={i}
          flex="1"
          minW="1.5"
          bg="teal.400"
          borderTopRadius="sm"
          h={`${Math.max(10, (v / max) * 100)}%`}
        />
      ))}
    </HStack>
  );
}

export function PublicHome() {
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['public_prices', state, city, search],
    queryFn: async () => {
      const { data } = await api.get('/api/public/prices', {
        params: { state: state || undefined, city: city || undefined, search: search || undefined },
      });
      return data.data as { prices: IPublicPrice[]; states: string[] };
    },
  });

  const prices = data?.prices ?? [];
  const states = data?.states ?? [];

  return (
    <Box minH="100dvh" bg="bg.app">
      <PublicHeader />

      <Box
        bgGradient="to-br"
        gradientFrom="teal.600"
        gradientTo="#0B544D"
        color="white"
        px={{ base: 4, md: 8 }}
        py={{ base: 10, md: 14 }}
      >
        <Stack maxW="6xl" mx="auto" gap="5" align="center" textAlign="center">
          <Heading size={{ base: '2xl', md: '3xl' }} fontFamily="heading" maxW="3xl">
            Quanto custa viver na sua cidade?
          </Heading>
          <Text fontSize={{ base: 'md', md: 'lg' }} color="whiteAlpha.800" maxW="2xl">
            Acompanhe a inflação real dos preços do dia a dia — do supermercado à conta de luz — a
            partir de notas fiscais reais, de forma anônima.
          </Text>

          <Card.Root w="full" maxW="4xl" bg="bg.surface" color="fg">
            <Card.Body>
              <Flex gap="3" wrap="wrap" align="end">
                <Box flex="1" minW="40">
                  <Text fontSize="xs" fontWeight="semibold" color="fg.muted" mb="1">
                    Estado
                  </Text>
                  <NativeSelect.Root>
                    <NativeSelect.Field value={state} onChange={(e) => setState(e.target.value)}>
                      <option value="">Todos</option>
                      {states.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Box>
                <Box flex="1" minW="40">
                  <Text fontSize="xs" fontWeight="semibold" color="fg.muted" mb="1">
                    Cidade
                  </Text>
                  <Input
                    placeholder="Sua cidade"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </Box>
                <Box flex="2" minW="48">
                  <Text fontSize="xs" fontWeight="semibold" color="fg.muted" mb="1">
                    Produto
                  </Text>
                  <Input
                    placeholder="Ex.: arroz, gasolina, energia…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </Box>
                <PrimaryButton>
                  <LuSearch /> Buscar
                </PrimaryButton>
              </Flex>
            </Card.Body>
          </Card.Root>
        </Stack>
      </Box>

      <Box px={{ base: 4, md: 8 }} py={{ base: 8, md: 12 }}>
        <Stack maxW="6xl" mx="auto" gap="5">
          <Stack gap="0.5">
            <Heading size="lg" fontFamily="heading">
              Preços monitorados {state ? `· ${state}` : ''}
            </Heading>
            <Text fontSize="sm" color="fg.muted">
              Média do preço unitário recente, agregada e anonimizada a partir de notas reais.
            </Text>
          </Stack>

          {isLoading ? (
            <Stack align="center" py="16">
              <Spinner />
            </Stack>
          ) : prices.length === 0 ? (
            <Text color="fg.muted" py="8">
              Ainda não há dados suficientes para esta região. Volte em breve.
            </Text>
          ) : (
            <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap="4">
              {prices.map((p) => (
                <Card.Root key={p.itemId} bg="bg.surface">
                  <Card.Body>
                    <Stack gap="3">
                      <Flex justify="space-between" align="start" gap="2">
                        <Stack gap="0">
                          <Text fontWeight="semibold" lineClamp={1}>
                            {p.name}
                          </Text>
                          <Text fontSize="xs" color="fg.muted">
                            {p.type === 'energy' ? 'Energia elétrica' : p.unit || 'unidade'} ·{' '}
                            {p.samples} amostras
                          </Text>
                        </Stack>
                        {p.type === 'energy' && <LuZap color="var(--chakra-colors-energy-solid)" />}
                      </Flex>
                      <Text fontSize="2xl" fontWeight="bold" fontFamily="heading">
                        {formatPrice(p.avgPrice, p.type === 'energy' ? 6 : 2)}
                        {p.type === 'energy' && (
                          <Text as="span" fontSize="sm" color="fg.muted">
                            {' '}
                            /kWh
                          </Text>
                        )}
                      </Text>
                      {p.series.length > 1 && <MiniBars values={p.series} />}
                    </Stack>
                  </Card.Body>
                </Card.Root>
              ))}
            </SimpleGrid>
          )}
        </Stack>
      </Box>

      <Box bg="bg.sidebar" color="white" px={{ base: 4, md: 8 }} py={{ base: 10, md: 12 }}>
        <Flex maxW="6xl" mx="auto" gap="4" justify="space-between" align="center" wrap="wrap">
          <Stack gap="1">
            <Heading size="lg" fontFamily="heading">
              Quer acompanhar a SUA inflação pessoal?
            </Heading>
            <Text color="whiteAlpha.700">
              Importe suas notas e compare seus gastos com o IPCA oficial — é grátis.
            </Text>
          </Stack>
          <PrimaryButton size="lg" asChild>
            <NextLink href="/register">Criar conta grátis</NextLink>
          </PrimaryButton>
        </Flex>
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
            <NextLink href="/termos">Termos de Uso</NextLink>
          </Button>
          <Button asChild variant="plain" color="whiteAlpha.700" size="sm" px="0">
            <NextLink href="/privacidade">Política de Privacidade</NextLink>
          </Button>
        </Flex>
      </Box>
    </Box>
  );
}
