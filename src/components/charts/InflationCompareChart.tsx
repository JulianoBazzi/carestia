'use client';

import { Chart, useChart } from '@chakra-ui/charts';
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts';
import type { IInflationSeriesPoint } from '~/services/invoice/analytics';

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  return `${m}/${y.slice(2)}`;
}

/** Barras agrupadas: inflação pessoal acumulada × IPCA acumulado, mês a mês (em %). */
export function InflationCompareChart({ series }: { series: IInflationSeriesPoint[] }) {
  const chart = useChart({
    data: series.map((p) => ({
      month: monthLabel(p.month),
      personal: Number((p.personalPct * 100).toFixed(2)),
      ipca: Number((p.ipcaPct * 100).toFixed(2)),
    })),
    series: [
      { name: 'personal', color: 'teal.solid', label: 'Minha inflação' },
      { name: 'ipca', color: 'gray.emphasized', label: 'IPCA' },
    ],
  });

  return (
    <Chart.Root maxH="2xs" chart={chart}>
      <BarChart data={chart.data}>
        <CartesianGrid stroke={chart.color('border.muted')} vertical={false} />
        <XAxis dataKey={chart.key('month')} tickLine={false} axisLine={false} fontSize={11} />
        <YAxis tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} fontSize={11} />
        <Tooltip cursor={false} content={<Chart.Tooltip />} />
        <Legend content={<Chart.Legend />} />
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
