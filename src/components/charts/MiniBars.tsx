'use client';

import { Box, HStack, Stack, Text } from '@chakra-ui/react';
import { formatPct, formatPrice } from '~/lib/format';

export interface IMiniBarsPoint {
  month: string; // "YYYY-MM"
  value: number;
}

/** "2026-03" → "03/26" (mesma convenção do InflationCompareChart). */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  return `${m}/${y.slice(2)}`;
}

/**
 * Sparkline da média mensal. A altura é escalada pela faixa min–max da própria
 * série, não por zero: preço de combustível varia 2–3% em 6 meses, e numa escala
 * a partir do zero todas as barras sairiam com a mesma altura (sem informação).
 * Cada barra tem `title` com mês e valor; abaixo vão o período e a variação.
 */
export function MiniBars({ points, decimals }: { points: IMiniBarsPoint[]; decimals: number }) {
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;

  const first = values[0];
  const last = values[values.length - 1];
  const delta = first > 0 ? (last - first) / first : 0;
  const rising = last > first;

  return (
    <Stack gap="1.5">
      <HStack gap="1" h="12" align="end">
        {points.map((p) => (
          <Box
            key={p.month}
            flex="1"
            minW="1.5"
            bg={rising ? 'orange.400' : 'teal.400'}
            borderTopRadius="sm"
            // Série plana (span 0) fica na meia-altura em vez de colar no topo.
            h={span > 0 ? `${15 + ((p.value - min) / span) * 85}%` : '50%'}
            title={`${monthLabel(p.month)}: ${formatPrice(p.value, decimals)}`}
          />
        ))}
      </HStack>
      <HStack justify="space-between" gap="2">
        <Text fontSize="xs" color="fg.muted">
          {monthLabel(points[0].month)} → {monthLabel(points[points.length - 1].month)}
        </Text>
        <Text
          fontSize="xs"
          fontWeight="semibold"
          color={rising ? 'orange.fg' : 'teal.fg'}
          fontVariantNumeric="tabular-nums"
        >
          {formatPct(delta, { signed: true })}
        </Text>
      </HStack>
    </Stack>
  );
}
