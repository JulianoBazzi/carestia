import { Card, Circle, HStack, Icon, SimpleGrid, Stat } from '@chakra-ui/react';
import { formatCurrency } from '@julianobazzi/utils';
import type { ReactNode } from 'react';
import { LuBoxes, LuReceipt, LuTicket, LuWallet } from 'react-icons/lu';
import type { IMetrics } from '~/services/invoice/analytics';

function MetricCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <Card.Root transition="box-shadow 0.2s" _hover={{ boxShadow: 'md' }}>
      <Card.Body>
        <HStack gap={3} align="center">
          <Circle
            size="10"
            bg={{ base: 'teal.50', _dark: 'teal.950' }}
            color="teal.500"
            flexShrink={0}
          >
            <Icon boxSize={5}>{icon}</Icon>
          </Circle>
          <Stat.Root>
            <Stat.Label>{label}</Stat.Label>
            <Stat.ValueText>{value}</Stat.ValueText>
          </Stat.Root>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
}

export function MetricsCards({ metrics }: { metrics: IMetrics }) {
  return (
    <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
      <MetricCard
        label="Gasto total"
        value={formatCurrency(metrics.totalSpent)}
        icon={<LuWallet />}
      />
      <MetricCard label="Notas" value={String(metrics.invoiceCount)} icon={<LuReceipt />} />
      <MetricCard
        label="Ticket médio"
        value={formatCurrency(metrics.avgTicket)}
        icon={<LuTicket />}
      />
      <MetricCard
        label="Produtos / Serviços"
        value={`${formatCurrency(metrics.byType.product)} / ${formatCurrency(metrics.byType.service)}`}
        icon={<LuBoxes />}
      />
    </SimpleGrid>
  );
}
