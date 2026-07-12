'use client';

import { Card, Flex, Heading, SegmentGroup, Stack, Table, Text } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { LuListChecks, LuPercent, LuScale } from 'react-icons/lu';
import { DashboardHeader, DashboardSkeleton } from '~/app/components/dashboard-skeleton';
import { AdSlot } from '~/components/Ad/AdSlot';
import { StatusBadge } from '~/components/Badge/StatusBadge';
import { InflationCompareChart } from '~/components/charts/InflationCompareChart';
import { EmptyState } from '~/components/EmptyState';
import { StatCard } from '~/components/StatCard';
import { formatPct, formatPp, formatPrice } from '~/lib/format';
import { useInflation } from '~/services/hooks/useInflation';
import type { IInflationItem, ItemKind } from '~/services/invoice/analytics';

const TYPE_TABS = [
  { value: '', label: 'Todos' },
  { value: 'product', label: 'Produtos' },
  { value: 'service', label: 'Serviços' },
  { value: 'energy', label: 'Energia' },
];

function typeBadge(type: ItemKind) {
  if (type === 'energy')
    return <StatusBadge withDot={false} label="Energia" colorPalette="energy" />;
  if (type === 'service')
    return <StatusBadge withDot={false} label="Serviço" colorPalette="purple" />;
  return <StatusBadge withDot={false} label="Produto" colorPalette="blue" />;
}

function priceOf(item: IInflationItem, value: number): string {
  return formatPrice(value, item.type === 'energy' ? 6 : 2);
}

export function DashboardCard() {
  const router = useRouter();
  const { data, isLoading } = useInflation();
  const [typeFilter, setTypeFilter] = useState('');

  const filteredItems = useMemo(() => {
    const items = data?.items ?? [];
    return typeFilter ? items.filter((i) => i.type === typeFilter) : items;
  }, [data, typeFilter]);

  if (isLoading || !data) {
    return <DashboardSkeleton />;
  }

  const { comparison, series, items, byCategory, ipcaAvailable } = data;
  const ipcaAcc = comparison.ipca;

  return (
    <Stack gap="6">
      <DashboardHeader />

      <AdSlot variant="banner" />

      <Flex gap="4" wrap="wrap">
        <StatCard
          label="Minha inflação"
          value={formatPct(comparison.personal, { signed: true })}
          icon={<LuPercent size={18} />}
          colorPalette={comparison.personal >= 0 ? 'red' : 'teal'}
          accentValue
        />
        <StatCard
          label="IPCA (oficial)"
          value={ipcaAvailable ? formatPct(comparison.ipca, { signed: true }) : '—'}
          icon={<LuScale size={18} />}
          colorPalette="gray"
          helpText={ipcaAvailable ? undefined : 'IPCA indisponível no momento'}
        />
        <StatCard
          label="Diferença"
          value={formatPp(comparison.diffPp)}
          icon={<LuScale size={18} />}
          colorPalette={comparison.diffPp >= 0 ? 'red' : 'teal'}
          accentValue
        />
        <StatCard
          label="Itens monitorados"
          value={items.length}
          icon={<LuListChecks size={18} />}
          colorPalette="teal"
        />
      </Flex>

      <Flex gap="5" align="start">
        <Stack flex="1" minW="0" gap="5">
          <Card.Root bg="bg.surface">
            <Card.Body>
              <Stack gap="3">
                <Heading size="sm" fontFamily="heading">
                  Inflação acumulada · mês a mês
                </Heading>
                {series.length === 0 ? (
                  <Text fontSize="sm" color="fg.muted">
                    Importe ao menos dois preços de um mesmo item para ver a evolução.
                  </Text>
                ) : (
                  <InflationCompareChart series={series} />
                )}
              </Stack>
            </Card.Body>
          </Card.Root>

          <Card.Root bg="bg.surface">
            <Card.Body>
              <Stack gap="4">
                <Heading size="sm" fontFamily="heading">
                  Inflação por categoria
                </Heading>
                {byCategory.length === 0 ? (
                  <EmptyState
                    icon={<LuPercent />}
                    title="Sem categorias ainda"
                    description="Categorize seus itens e importe ao menos dois preços para ver a inflação por categoria."
                  />
                ) : (
                  <Table.Root size="sm">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>Categoria</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="center">Itens</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="end">Inflação</Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {byCategory.map((cat) => (
                        <Table.Row key={cat.category}>
                          <Table.Cell>
                            <Text fontWeight="medium" lineClamp={1}>
                              {cat.category}
                            </Text>
                          </Table.Cell>
                          <Table.Cell textAlign="center">{cat.itemCount}</Table.Cell>
                          <Table.Cell textAlign="end">
                            <Text
                              color={cat.index >= 0 ? 'price.up' : 'price.down'}
                              fontWeight="semibold"
                            >
                              {formatPct(cat.index, { signed: true })}
                            </Text>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                )}
              </Stack>
            </Card.Body>
          </Card.Root>

          <Card.Root bg="bg.surface">
            <Card.Body>
              <Stack gap="4">
                <Flex justify="space-between" align="center" gap="3" wrap="wrap">
                  <Heading size="sm" fontFamily="heading">
                    Inflação item a item vs IPCA
                  </Heading>
                  <SegmentGroup.Root
                    size="sm"
                    value={typeFilter}
                    onValueChange={(e) => setTypeFilter(e.value ?? '')}
                  >
                    <SegmentGroup.Indicator />
                    {TYPE_TABS.map((t) => (
                      <SegmentGroup.Item key={t.value} value={t.value}>
                        <SegmentGroup.ItemText>{t.label}</SegmentGroup.ItemText>
                        <SegmentGroup.ItemHiddenInput />
                      </SegmentGroup.Item>
                    ))}
                  </SegmentGroup.Root>
                </Flex>

                {filteredItems.length === 0 ? (
                  <EmptyState
                    icon={<LuListChecks />}
                    title="Nenhum item com histórico suficiente"
                    description="Importe notas com o mesmo item ao menos duas vezes para calcular a variação."
                  />
                ) : (
                  <Table.Root size="sm" interactive>
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>Item</Table.ColumnHeader>
                        <Table.ColumnHeader>Tipo</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="center">Preços</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="end">1º preço</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="end">Último</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="end">Variação</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="end">vs IPCA</Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {filteredItems.map((item) => (
                        <Table.Row
                          key={item.itemId}
                          cursor="pointer"
                          onClick={() => router.push(`/inflation/${item.itemId}`)}
                        >
                          <Table.Cell>
                            <Text fontWeight="medium" lineClamp={1}>
                              {item.name}
                            </Text>
                            <Text fontSize="xs" color="fg.muted">
                              {item.referenceCode}
                            </Text>
                          </Table.Cell>
                          <Table.Cell>{typeBadge(item.type)}</Table.Cell>
                          <Table.Cell textAlign="center">{item.count}</Table.Cell>
                          <Table.Cell textAlign="end">{priceOf(item, item.firstValue)}</Table.Cell>
                          <Table.Cell textAlign="end">{priceOf(item, item.lastValue)}</Table.Cell>
                          <Table.Cell textAlign="end">
                            <Text
                              color={item.variationPct >= 0 ? 'price.up' : 'price.down'}
                              fontWeight="semibold"
                            >
                              {formatPct(item.variationPct, { signed: true })}
                            </Text>
                          </Table.Cell>
                          <Table.Cell textAlign="end" color="fg.muted">
                            {formatPp((item.variationPct - ipcaAcc) * 100)}
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                )}
              </Stack>
            </Card.Body>
          </Card.Root>
        </Stack>
        <Stack display={{ base: 'none', xl: 'flex' }} gap="4">
          <AdSlot variant="vertical" />
          <AdSlot variant="square" />
        </Stack>
      </Flex>
    </Stack>
  );
}
