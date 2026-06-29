import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { getSession } from '~/lib/auth/current-user';
import { comparePersonalVsIpca, groupInflationByCategory } from '~/services/invoice/analytics';
import { getInflation, getInvoiceDateRange } from '~/services/invoice/queries';
import { fetchIpca } from '~/services/ipca';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado.' }, { status: StatusCodes.UNAUTHORIZED });
  }

  const inflation = await getInflation(session.sub);
  const range = await getInvoiceDateRange(session.sub);
  const ipcaSeries = range ? await fetchIpca(range.from, range.to) : [];
  const comparison = comparePersonalVsIpca(inflation.index, ipcaSeries);
  const byCategory = groupInflationByCategory(inflation.items);

  return NextResponse.json({
    data: {
      index: inflation.index,
      items: inflation.items,
      ipcaAvailable: ipcaSeries.length > 0,
      comparison,
      byCategory,
    },
  });
}
