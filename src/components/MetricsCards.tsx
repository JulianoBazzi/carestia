import { Card, SimpleGrid, Stat } from '@chakra-ui/react';
import { formatCurrency } from '@julianobazzi/utils';
import { fromCents } from '~/lib/money';
import type { IMetrics } from '~/services/invoice/analytics';

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card.Root>
      <Card.Body>
        <Stat.Root>
          <Stat.Label>{label}</Stat.Label>
          <Stat.ValueText>{value}</Stat.ValueText>
        </Stat.Root>
      </Card.Body>
    </Card.Root>
  );
}

export function MetricsCards({ metrics }: { metrics: IMetrics }) {
  return (
    <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
      <MetricCard label="Gasto total" value={formatCurrency(fromCents(metrics.totalSpent))} />
      <MetricCard label="Notas" value={String(metrics.invoiceCount)} />
      <MetricCard label="Ticket médio" value={formatCurrency(fromCents(metrics.avgTicket))} />
      <MetricCard
        label="Produtos / Serviços"
        value={`${formatCurrency(fromCents(metrics.byType.product))} / ${formatCurrency(fromCents(metrics.byType.service))}`}
      />
    </SimpleGrid>
  );
}
