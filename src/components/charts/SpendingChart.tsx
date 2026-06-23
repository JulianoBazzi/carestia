'use client';

import { Chart, useChart } from '@chakra-ui/charts';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';

export interface ISpendingPoint {
  month: string; // "MM/YYYY"
  total: number; // reais
}

export function SpendingChart({ data }: { data: ISpendingPoint[] }) {
  const chart = useChart({
    data,
    series: [{ name: 'total', color: 'teal.solid', label: 'Gasto' }],
  });

  return (
    <Chart.Root maxH="xs" chart={chart}>
      <BarChart data={chart.data}>
        <CartesianGrid stroke={chart.color('border.muted')} vertical={false} />
        <XAxis dataKey={chart.key('month')} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={(v) => `R$ ${v}`} tickLine={false} axisLine={false} />
        <Tooltip cursor={false} content={<Chart.Tooltip />} />
        {chart.series.map((item) => (
          <Bar
            key={item.name}
            dataKey={chart.key(item.name)}
            fill={chart.color(item.color)}
            radius={4}
          />
        ))}
      </BarChart>
    </Chart.Root>
  );
}
