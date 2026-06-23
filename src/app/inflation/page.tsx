import {
  Badge,
  Box,
  Card,
  Container,
  Heading,
  SimpleGrid,
  Stack,
  Stat,
  Table,
  Text,
} from '@chakra-ui/react';
import { formatCurrency, formatPercentage } from '@julianobazzi/utils';
import { redirect } from 'next/navigation';
import { AppHeader } from '~/components/AppHeader';
import { ItemPriceChart } from '~/components/charts/ItemPriceChart';
import { getSession } from '~/lib/auth/current-user';
import { fromCents } from '~/lib/money';
import { comparePersonalVsIpca, groupInflationByCategory } from '~/services/invoice/analytics';
import { getInflation, getInvoiceDateRange } from '~/services/invoice/queries';
import { fetchIpca } from '~/services/ipca';

function variationColor(pct: number) {
  if (pct > 0) return 'red';
  if (pct < 0) return 'green';
  return 'gray';
}

function dayLabel(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

export default async function InflationPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const inflation = await getInflation(session.sub);
  const range = await getInvoiceDateRange(session.sub);
  const ipcaSeries = range ? await fetchIpca(range.from, range.to) : [];
  const comparison = comparePersonalVsIpca(inflation.index, ipcaSeries);
  const byCategory = groupInflationByCategory(inflation.items);
  const featured = [...inflation.items].sort((a, b) => b.count - a.count)[0];

  return (
    <Box minH="100dvh">
      <Container maxW="5xl" py={{ base: 4, md: 8 }}>
        <AppHeader />

        <Stack gap={6}>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
            <Card.Root>
              <Card.Body>
                <Stat.Root>
                  <Stat.Label>Índice de inflação pessoal</Stat.Label>
                  <Stat.ValueText color={`${variationColor(inflation.index)}.500`}>
                    {formatPercentage(inflation.index * 100)}
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
                    {ipcaSeries.length === 0 ? '—' : formatPercentage(comparison.ipca * 100)}
                  </Stat.ValueText>
                  <Stat.HelpText>
                    {ipcaSeries.length === 0
                      ? 'IPCA indisponível'
                      : `você está ${comparison.diffPp >= 0 ? 'acima' : 'abaixo'} em ${Math.abs(comparison.diffPp).toFixed(2)} p.p.`}
                  </Stat.HelpText>
                </Stat.Root>
              </Card.Body>
            </Card.Root>
          </SimpleGrid>

          {inflation.items.length === 0 ? (
            <Text color="fg.muted">
              Importe ao menos 2 notas com o mesmo item para ver a variação de preço.
            </Text>
          ) : (
            <>
              {featured && (
                <Box borderWidth="1px" borderRadius="md" p={4}>
                  <Heading size="sm" mb={4}>
                    Evolução de preço · {featured.name}
                  </Heading>
                  <ItemPriceChart
                    label={featured.name}
                    data={featured.history.map((h) => ({
                      date: dayLabel(h.date),
                      price: fromCents(h.unitValue),
                    }))}
                  />
                </Box>
              )}

              {byCategory.length > 0 && (
                <Box borderWidth="1px" borderRadius="md" p={4}>
                  <Heading size="sm" mb={3}>
                    Inflação por categoria
                  </Heading>
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
                </Box>
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
                  {inflation.items.map((item) => (
                    <Table.Row key={item.itemId}>
                      <Table.Cell>{item.name}</Table.Cell>
                      <Table.Cell>{item.referenceCode}</Table.Cell>
                      <Table.Cell textAlign="end">{item.count}</Table.Cell>
                      <Table.Cell textAlign="end">
                        {formatCurrency(fromCents(item.firstValue))}
                      </Table.Cell>
                      <Table.Cell textAlign="end">
                        {formatCurrency(fromCents(item.lastValue))}
                      </Table.Cell>
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
      </Container>
    </Box>
  );
}
