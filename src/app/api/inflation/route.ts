import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { getSession } from '~/lib/auth/current-user';
import { safeRoute } from '~/lib/http';
import {
  comparePersonalVsIpca,
  computeInflation,
  computeMonthlyInflationSeries,
  groupInflationByCategory,
} from '~/services/invoice/analytics';
import { getInflationRows, getInvoiceDateRange } from '~/services/invoice/queries';
import { fetchIpca } from '~/services/ipca';

export const runtime = 'nodejs';

export const GET = safeRoute(async () => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  const rows = await getInflationRows(session.sub);
  const inflation = computeInflation(rows);
  const range = await getInvoiceDateRange(session.sub);
  const ipcaSeries = range ? await fetchIpca(range.from, range.to) : [];
  const comparison = comparePersonalVsIpca(inflation.index, ipcaSeries);
  const series = computeMonthlyInflationSeries(rows, ipcaSeries);
  const byCategory = groupInflationByCategory(inflation.items);

  return NextResponse.json({
    data: {
      index: inflation.index,
      items: inflation.items,
      ipcaAvailable: ipcaSeries.length > 0,
      comparison,
      series,
      byCategory,
    },
  });
});
