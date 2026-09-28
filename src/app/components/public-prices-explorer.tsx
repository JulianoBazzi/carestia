'use client';

import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Input,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useDebounce } from '@julianobazzi/nextjs-utils';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { LuChartLine, LuMapPin, LuSearch, LuTriangleAlert, LuZap } from 'react-icons/lu';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import { MiniBars } from '~/components/charts/MiniBars';
import { EmptyState } from '~/components/EmptyState';
import { Select } from '~/components/Form/Select';
import { API_URL_PUBLIC_PRICES, TABLE_PUBLIC_PRICES } from '~/config/constants';
import { formatPrice, samplesText } from '~/lib/format';
import { api } from '~/services/apiClient';

interface IPublicPriceSeriesPoint {
  month: string; // "YYYY-MM"
  value: number;
}

interface IPublicPrice {
  itemId: string;
  name: string;
  type: 'product' | 'service' | 'energy';
  unit: string | null;
  avgPrice: number;
  samples: number;
  series: IPublicPriceSeriesPoint[];
}

interface IPublicPricesExplorerProps {
  /**
   * Ação do empty state de "sem dados ainda". Deslogado é o CTA de cadastro;
   * logado, o atalho para importar notas.
   */
  emptyAction?: ReactNode;
}

function PriceCardSkeleton() {
  return (
    <Card.Root bg="bg.surface">
      <Card.Body>
        <Stack gap="3">
          <Stack gap="1">
            <Skeleton h="4" w="60%" />
            <Skeleton h="3" w="40%" />
          </Stack>
          <Skeleton h="7" w="50%" />
          <Skeleton h="12" w="full" />
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}

/**
 * Índice geral de preços: filtros + grade de médias por item/região. Usado tanto
 * na landing pública quanto na tela do usuário logado — o que muda entre as duas
 * é só o entorno (hero/footer vs. Template) e o CTA do empty state.
 */
/** Espera o usuário parar de digitar antes de consultar (uma requisição, não uma por tecla). */
const TYPING_DEBOUNCE_MS = 400;

export function PublicPricesExplorer({ emptyAction }: IPublicPricesExplorerProps) {
  const [state, setState] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const debouncedCity = useDebounce(cityInput, TYPING_DEBOUNCE_MS);
  const debouncedSearch = useDebounce(searchInput, TYPING_DEBOUNCE_MS);
  // Filtros de texto efetivamente consultados: seguem o debounce, e o "Buscar"
  // (ou Enter) aplica na hora.
  const [applied, setApplied] = useState({ city: '', search: '' });
  // Lista de UFs acumulada: com uma UF filtrada, a API só devolve essa — o
  // select não pode encolher para uma opção só.
  const [stateOptions, setStateOptions] = useState<string[]>([]);

  useEffect(() => {
    setApplied({ city: debouncedCity.trim(), search: debouncedSearch.trim() });
  }, [debouncedCity, debouncedSearch]);

  const { city, search } = applied;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [TABLE_PUBLIC_PRICES, state, city, search],
    // Mantém a grade anterior enquanto o filtro novo carrega (sem piscar skeleton).
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data } = await api.get(API_URL_PUBLIC_PRICES, {
        params: {
          state: state || undefined,
          city: city || undefined,
          search: search || undefined,
        },
      });
      return data.data as { prices: IPublicPrice[]; states: string[] };
    },
  });

  useEffect(() => {
    if (data?.states.length) {
      setStateOptions((prev) => Array.from(new Set([...prev, ...data.states])).sort());
    }
  }, [data]);

  const prices = data?.prices ?? [];
  const hasFilters = Boolean(state || city || search);

  const clearFilters = () => {
    setState('');
    setCityInput('');
    setSearchInput('');
    setApplied({ city: '', search: '' });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setApplied({ city: cityInput.trim(), search: searchInput.trim() });
  };

  return (
    <Stack gap="6">
      <Card.Root bg="bg.surface" asChild>
        <form onSubmit={onSubmit}>
          <Card.Body>
            <Flex gap="3" wrap="wrap" align="end">
              <Box flex="1" minW="40">
                <Text fontSize="xs" fontWeight="semibold" color="fg.muted" mb="1">
                  Estado
                </Text>
                <Select
                  name="public-state"
                  clearable
                  placeholder="Todos"
                  options={stateOptions.map((s: string) => ({ value: s, label: s }))}
                  value={state}
                  onChange={(v) => setState(v ?? '')}
                />
              </Box>
              <Box flex="1" minW="40">
                <Text fontSize="xs" fontWeight="semibold" color="fg.muted" mb="1">
                  Cidade
                </Text>
                <Input
                  aria-label="Cidade"
                  placeholder="Sua cidade"
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                />
              </Box>
              <Box flex="2" minW="48">
                <Text fontSize="xs" fontWeight="semibold" color="fg.muted" mb="1">
                  Produto
                </Text>
                <Input
                  aria-label="Produto"
                  placeholder="Ex.: arroz, gasolina, energia…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </Box>
              <PrimaryButton type="submit">
                <LuSearch /> Buscar
              </PrimaryButton>
            </Flex>
          </Card.Body>
        </form>
      </Card.Root>

      <Stack gap="5">
        <Stack gap="0.5">
          <Heading size="lg" fontFamily="heading">
            Preços monitorados {state ? `· ${state}` : ''}
          </Heading>
          <Text fontSize="sm" color="fg.muted">
            Média do preço unitário recente, agregada e anonimizada a partir de notas fiscais e
            etiquetas de preço reais.
          </Text>
        </Stack>

        {isError && !data ? (
          <Card.Root bg="bg.surface">
            <Card.Body>
              <EmptyState
                icon={<LuTriangleAlert />}
                title="Não foi possível carregar os preços"
                description="Houve um problema ao consultar o índice. Tente novamente em instantes."
                action={
                  <Button variant="outline" onClick={() => refetch()}>
                    Tentar novamente
                  </Button>
                }
              />
            </Card.Body>
          </Card.Root>
        ) : isLoading ? (
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap="4">
            {Array.from({ length: 6 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeletons estáticos
              <PriceCardSkeleton key={i} />
            ))}
          </SimpleGrid>
        ) : prices.length === 0 ? (
          <Card.Root bg="bg.surface">
            <Card.Body>
              {hasFilters ? (
                <EmptyState
                  icon={<LuMapPin />}
                  title="Nenhum resultado para esta busca"
                  description="Não encontramos preços com esses filtros. Tente outra cidade, estado ou produto."
                  action={
                    <Button variant="outline" onClick={clearFilters}>
                      Limpar filtros
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={<LuChartLine />}
                  title="Ainda estamos reunindo dados"
                  description="Assim que mais notas forem importadas, os preços da sua região aparecem aqui."
                  action={emptyAction}
                />
              )}
            </Card.Body>
          </Card.Root>
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
                          {samplesText(p.samples)}
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
                    {p.series.length > 1 && (
                      <MiniBars points={p.series} decimals={p.type === 'energy' ? 6 : 2} />
                    )}
                  </Stack>
                </Card.Body>
              </Card.Root>
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </Stack>
  );
}
