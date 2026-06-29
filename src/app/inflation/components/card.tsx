'use client';

import {
  Badge,
  Card,
  Heading,
  HStack,
  Icon,
  SimpleGrid,
  Spinner,
  Stack,
  Stat,
  Table,
  Text,
} from '@chakra-ui/react';
import { formatCurrency, formatPercentage } from '@julianobazzi/utils';
import { LuChartLine, LuLayers } from 'react-icons/lu';
import { ItemPriceChart } from '~/components/charts/ItemPriceChart';
import { fromCents } from '~/lib/money';
import { useInflation } from '~/services/hooks/useInflation';

function variationColor(pct: number) {
  if (pct > 0) return 'red';
  if (pct < 0) return 'green';
  return 'gray';
}

function dayLabel(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

export function InflationCard() {
  const { data, isLoading } = useInflation();

  if (isLoading || !data) {
    return (
      <Stack align="center" py="20">
        <Spinner />
      </Stack>
    );
  }

  const { index, items, ipcaAvailable, comparison, byCategory } = data;
  const featured = [...items].sort((a, b) => b.count - a.count)[0];

  return (
    <Stack gap={6}>
      <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
        <Card.Root>
          <Card.Body>
            <Stat.Root>
              <Stat.Label>Índice de inflação pessoal</Stat.Label>
              <Stat.ValueText color={`${variationColor(index)}.500`}>
                {formatPercentage(index * 100)}
              </Stat.ValueText>
              <Stat.HelpText>variação ponderada dos itens recomprados</Stat.HelpText>
            </Stat.Root>
          </Card.Body>
        </Card.Root>

        <Card.Root>
          <Card.Body>
            <Stat.Root>
              <Stat.Label>IPCA oficial (mesmo período)</Stat.Label>
              <Stat.ValueText>
                {!ipcaAvailable ? '—' : formatPercentage(comparison.ipca * 100)}
              </Stat.ValueText>
              <Stat.HelpText>
                {!ipcaAvailable
                  ? 'IPCA indisponível'
                  : `você está ${comparison.diffPp >= 0 ? 'acima' : 'abaixo'} em ${Math.abs(comparison.diffPp).toFixed(2)} p.p.`}
              </Stat.HelpText>
            </Stat.Root>
          </Card.Body>
        </Card.Root>
      </SimpleGrid>

      {items.length === 0 ? (
        <Text color="fg.muted">
          Importe ao menos 2 notas com o mesmo item para ver a variação de preço.
        </Text>
      ) : (
        <>
          {featured && (
            <Card.Root>
              <Card.Body>
                <HStack gap={2} mb={4}>
                  <Icon color="teal.500">
                    <LuChartLine />
                  </Icon>
                  <Heading size="sm">Evolução de preço · {featured.name}</Heading>
                </HStack>
                <ItemPriceChart
                  label={featured.name}
                  data={featured.history.map((h) => ({
                    date: dayLabel(h.date),
                    price: fromCents(h.unitValue),
                  }))}
                />
              </Card.Body>
            </Card.Root>
          )}

          {byCategory.length > 0 && (
            <Card.Root>
              <Card.Body>
                <HStack gap={2} mb={3}>
                  <Icon color="teal.500">
                    <LuLayers />
                  </Icon>
                  <Heading size="sm">Inflação por categoria</Heading>
                </HStack>
                <Table.Root size="sm">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeader>Categoria</Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="end">Itens</Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="end">Variação</Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {byCategory.map((cat) => (
                      <Table.Row key={cat.category}>
                        <Table.Cell>{cat.category}</Table.Cell>
                        <Table.Cell textAlign="end">{cat.itemCount}</Table.Cell>
                        <Table.Cell textAlign="end">
                          <Badge colorPalette={variationColor(cat.index)}>
                            {formatPercentage(cat.index * 100)}
                          </Badge>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Card.Body>
            </Card.Root>
          )}

          <Table.Root size="sm" variant="outline">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Item</Table.ColumnHeader>
                <Table.ColumnHeader>Ref</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">Compras</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">1º preço</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">Último</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">Variação</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {items.map((item) => (
                <Table.Row key={item.itemId}>
                  <Table.Cell>{item.name}</Table.Cell>
                  <Table.Cell>{item.referenceCode}</Table.Cell>
                  <Table.Cell textAlign="end">{item.count}</Table.Cell>
                  <Table.Cell textAlign="end">{formatCurrency(item.firstValue)}</Table.Cell>
                  <Table.Cell textAlign="end">{formatCurrency(item.lastValue)}</Table.Cell>
                  <Table.Cell textAlign="end">
                    <Badge colorPalette={variationColor(item.variationPct)}>
                      {formatPercentage(item.variationPct * 100)}
                    </Badge>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </>
      )}
    </Stack>
  );
}
