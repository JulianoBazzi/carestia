'use client';

import { Chart, useChart } from '@chakra-ui/charts';
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';

export interface IPricePoint {
  date: string; // "DD/MM/YYYY"
  price: number; // reais
}

export function ItemPriceChart({ data, label }: { data: IPricePoint[]; label: string }) {
  const chart = useChart({
    data,
    series: [{ name: 'price', color: 'purple.solid', label }],
  });

  return (
    <Chart.Root maxH="sm" chart={chart}>
      <LineChart data={chart.data}>
        <CartesianGrid stroke={chart.color('border.muted')} vertical={false} />
        <XAxis dataKey={chart.key('date')} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={(v) => `R$ ${v}`} tickLine={false} axisLine={false} />
        <Tooltip cursor={false} content={<Chart.Tooltip />} />
        {chart.series.map((item) => (
          <Line
            key={item.name}
            dataKey={chart.key(item.name)}
            stroke={chart.color(item.color)}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </Chart.Root>
  );
}
