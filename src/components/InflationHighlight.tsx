import { Badge, Card, Heading, HStack, Icon, Stack, Stat, Text } from '@chakra-ui/react';
import { formatPercentage } from '@julianobazzi/utils';
import { LuTrendingUp } from 'react-icons/lu';
import type { IInflation } from '~/services/invoice/analytics';

function variationColor(pct: number) {
  if (pct > 0) return 'red';
  if (pct < 0) return 'green';
  return 'gray';
}

export function InflationHighlight({ inflation }: { inflation: IInflation }) {
  const top = inflation.items.slice(0, 3);

  return (
    <Card.Root>
      <Card.Body>
        <Stack gap={4}>
          <HStack gap={2}>
            <Icon color="teal.500">
              <LuTrendingUp />
            </Icon>
            <Heading size="sm">Inflação pessoal</Heading>
          </HStack>
          <Stat.Root>
            <Stat.Label>Seu índice de inflação pessoal</Stat.Label>
            <Stat.ValueText color={`${variationColor(inflation.index)}.500`}>
              {formatPercentage(inflation.index * 100)}
            </Stat.ValueText>
            <Stat.HelpText>variação ponderada dos itens recomprados</Stat.HelpText>
          </Stat.Root>

          {top.length === 0 ? (
            <Text fontSize="sm" color="fg.muted">
              Importe ao menos 2 notas com o mesmo item para calcular a variação.
            </Text>
          ) : (
            <Stack gap={2}>
              {top.map((item) => (
                <HStack key={item.itemId} justify="space-between">
                  <Text fontSize="sm" lineClamp={1}>
                    {item.name}
                  </Text>
                  <Badge colorPalette={variationColor(item.variationPct)}>
                    {formatPercentage(item.variationPct * 100)}
                  </Badge>
                </HStack>
              ))}
            </Stack>
          )}
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}
