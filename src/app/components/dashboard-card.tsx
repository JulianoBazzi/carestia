'use client';

import {
  Card,
  Link as CLink,
  Grid,
  GridItem,
  Heading,
  HStack,
  Icon,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react';
import { formatCurrency } from '@julianobazzi/utils';
import NextLink from 'next/link';
import { LuChartColumn } from 'react-icons/lu';
import { SpendingChart } from '~/components/charts/SpendingChart';
import { InflationHighlight } from '~/components/InflationHighlight';
import { InvoiceUpload } from '~/components/InvoiceUpload';
import { MetricsCards } from '~/components/MetricsCards';
import { fromCents } from '~/lib/money';
import { useDashboardMetrics } from '~/services/hooks/useDashboard';
import { useInflation } from '~/services/hooks/useInflation';

function monthLabel(ym: string): string {
  const [year, month] = ym.split('-');
  return `${month}/${year}`;
}

export function DashboardCard() {
  const metricsQuery = useDashboardMetrics();
  const inflationQuery = useInflation();
  const metrics = metricsQuery.data;
  const inflation = inflationQuery.data;

  if (!metrics) {
    return (
      <Stack align="center" py="20">
        <Spinner />
      </Stack>
    );
  }

  const spending = metrics.perMonth.map((p) => ({
    month: monthLabel(p.month),
    total: fromCents(p.total),
  }));

  return (
    <Stack gap={6}>
      <MetricsCards metrics={metrics} />

      <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6}>
        <GridItem>
          <Card.Root h="full">
            <Card.Body>
              <HStack gap={2} mb={4}>
                <Icon color="teal.500">
                  <LuChartColumn />
                </Icon>
                <Heading size="sm">Gasto por mês</Heading>
              </HStack>
              {spending.length === 0 ? (
                <Text color="fg.muted" fontSize="sm">
                  Sem dados ainda.
                </Text>
              ) : (
                <SpendingChart data={spending} />
              )}
            </Card.Body>
          </Card.Root>
        </GridItem>
        <GridItem>
          {inflation && (
            <InflationHighlight inflation={{ index: inflation.index, items: inflation.items }} />
          )}
        </GridItem>
      </Grid>

      <InvoiceUpload />

      <HStack justify="space-between">
        <Text color="fg.muted" fontSize="sm">
          Total gasto: {formatCurrency(metrics.totalSpent)}
        </Text>
        <CLink asChild fontSize="sm" color="teal.600" fontWeight="medium">
          <NextLink href="/invoices">Ver todas as notas →</NextLink>
        </CLink>
      </HStack>
    </Stack>
  );
}
