'use client';

import { Card, Link as CLink, Flex, Heading, Spinner, Stack, Table, Text } from '@chakra-ui/react';
import NextLink from 'next/link';
import { LuArrowLeft, LuListChecks, LuPercent, LuScale, LuTrendingUp } from 'react-icons/lu';
import { StatusBadge } from '~/components/Badge/StatusBadge';
import { ItemPriceChart } from '~/components/charts/ItemPriceChart';
import { StatCard } from '~/components/StatCard';
import { formatPct, formatPp, formatPrice } from '~/lib/format';
import { useInflation } from '~/services/hooks/useInflation';
import type { ItemKind } from '~/services/invoice/analytics';

function typeBadge(type: ItemKind) {
  if (type === 'energy') {
    return <StatusBadge withDot={false} label="Energia" colorPalette="energy" />;
  }
  if (type === 'service') {
    return <StatusBadge withDot={false} label="Serviço" colorPalette="purple" />;
  }
  return <StatusBadge withDot={false} label="Produto" colorPalette="blue" />;
}

export function ItemInflationDetail({ itemId }: { itemId: string }) {
  const { data, isLoading } = useInflation();

  if (isLoading || !data) {
    return (
      <Stack align="center" py="20">
        <Spinner />
      </Stack>
    );
  }

  const item = data.items.find((i) => i.itemId === itemId);
  if (!item) {
    return (
      <Stack gap="3" py="10" align="center">
        <Text color="fg.muted">Item não encontrado ou sem histórico suficiente.</Text>
        <CLink asChild color="teal.600" fontWeight="medium">
          <NextLink href="/dashboard">← Voltar ao dashboard</NextLink>
        </CLink>
      </Stack>
    );
  }

  const decimals = item.type === 'energy' ? 6 : 2;
  const ipcaAcc = data.comparison.ipca;
  const vsIpca = (item.variationPct - ipcaAcc) * 100;

  return (
    <Stack gap="6">
      <Stack gap="1">
        <CLink asChild color="fg.muted" fontSize="sm" w="fit-content">
          <NextLink href="/dashboard">
            <LuArrowLeft size={14} /> Voltar ao dashboard
          </NextLink>
        </CLink>
        <Flex justify="space-between" align="center" gap="3" wrap="wrap">
          <Stack gap="0.5">
            <Heading size="lg" fontFamily="heading">
              {item.name}
            </Heading>
            <Text fontSize="sm" color="fg.muted">
              {item.referenceCode} · {item.count} preços registrados
            </Text>
          </Stack>
          {typeBadge(item.type)}
        </Flex>
      </Stack>

      <Flex gap="4" wrap="wrap">
        <StatCard
          label="Último preço"
          value={formatPrice(item.lastValue, decimals)}
          icon={<LuTrendingUp size={18} />}
          colorPalette="teal"
        />
        <StatCard
          label="Inflação do item"
          value={formatPct(item.variationPct, { signed: true })}
          icon={<LuPercent size={18} />}
          colorPalette={item.variationPct >= 0 ? 'red' : 'teal'}
          accentValue
        />
        <StatCard
          label="IPCA (período)"
          value={formatPct(ipcaAcc, { signed: true })}
          icon={<LuScale size={18} />}
          colorPalette="gray"
        />
        <StatCard
          label="Diferença vs IPCA"
          value={formatPp(vsIpca)}
          icon={<LuListChecks size={18} />}
          colorPalette={vsIpca >= 0 ? 'red' : 'teal'}
          accentValue
        />
      </Flex>

      <Card.Root bg="bg.surface">
        <Card.Body>
          <Stack gap="3">
            <Heading size="sm" fontFamily="heading">
              Histórico de preço unitário
            </Heading>
            <ItemPriceChart
              data={item.history.map((h) => ({ date: h.date, price: h.unitValue }))}
              label={item.type === 'energy' ? 'R$/kWh' : 'Preço unitário'}
            />
          </Stack>
        </Card.Body>
      </Card.Root>

      <Card.Root bg="bg.surface">
        <Card.Body>
          <Stack gap="3">
            <Heading size="sm" fontFamily="heading">
              Preços registrados
            </Heading>
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Data</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Preço unitário</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {item.history.map((h) => (
                  <Table.Row key={`${h.date}-${h.unitValue}`}>
                    <Table.Cell>{h.date}</Table.Cell>
                    <Table.Cell textAlign="end">{formatPrice(h.unitValue, decimals)}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Stack>
        </Card.Body>
      </Card.Root>
    </Stack>
  );
}
