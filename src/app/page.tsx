import {
  Box,
  Link as CLink,
  Container,
  Grid,
  GridItem,
  Heading,
  HStack,
  Stack,
  Text,
} from '@chakra-ui/react';
import { formatCurrency } from '@julianobazzi/utils';
import NextLink from 'next/link';
import { redirect } from 'next/navigation';
import { AppHeader } from '~/components/AppHeader';
import { SpendingChart } from '~/components/charts/SpendingChart';
import { InflationHighlight } from '~/components/InflationHighlight';
import { InvoiceUpload } from '~/components/InvoiceUpload';
import { MetricsCards } from '~/components/MetricsCards';
import { getSession } from '~/lib/auth/current-user';
import { fromCents } from '~/lib/money';
import { getDashboardMetrics, getInflation } from '~/services/invoice/queries';

function monthLabel(ym: string): string {
  const [year, month] = ym.split('-');
  return `${month}/${year}`;
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [metrics, inflation] = await Promise.all([
    getDashboardMetrics(session.sub),
    getInflation(session.sub),
  ]);

  const spending = metrics.perMonth.map((p) => ({
    month: monthLabel(p.month),
    total: fromCents(p.total),
  }));

  return (
    <Box minH="100dvh">
      <Container maxW="5xl" py={{ base: 4, md: 8 }}>
        <AppHeader />

        <Stack gap={6}>
          <MetricsCards metrics={metrics} />

          <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6}>
            <GridItem>
              <Box borderWidth="1px" borderRadius="md" p={4}>
                <Heading size="sm" mb={4}>
                  Gasto por mês
                </Heading>
                {spending.length === 0 ? (
                  <Text color="fg.muted" fontSize="sm">
                    Sem dados ainda.
                  </Text>
                ) : (
                  <SpendingChart data={spending} />
                )}
              </Box>
            </GridItem>
            <GridItem>
              <InflationHighlight inflation={inflation} />
            </GridItem>
          </Grid>

          <InvoiceUpload />

          <HStack justify="space-between">
            <Text color="fg.muted" fontSize="sm">
              Total gasto: {formatCurrency(fromCents(metrics.totalSpent))}
            </Text>
            <CLink asChild fontSize="sm">
              <NextLink href="/invoices">Ver todas as notas →</NextLink>
            </CLink>
          </HStack>
        </Stack>
      </Container>
    </Box>
  );
}
