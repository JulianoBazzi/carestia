import { formatCNPJ, formatDate } from '@julianobazzi/utils';
import { type QueryObserverOptions, useQuery } from '@tanstack/react-query';
import { API_URL_INVOICES, TABLE_INVOICES } from '~/config/constants';
import type IInvoiceAPI from '~/models/Entity/Invoice/IInvoiceAPI';
import type IInvoiceParamsRequest from '~/models/Request/IInvoiceParamsRequest';
import type IListResponse from '~/models/Response/IListResponse';
import { api } from '~/services/apiClient';

/** Rótulo e cor do badge por modelo de nota. */
export function invoiceModelInfo(model: IInvoiceAPI['model']): {
  label: string;
  colorPalette: string;
} {
  switch (model) {
    case 'nfce':
      return { label: 'NFC-e', colorPalette: 'teal' };
    case 'nfse':
      return { label: 'NFS-e', colorPalette: 'purple' };
    case 'nf3e':
      return { label: 'NF3e', colorPalette: 'energy' };
    default:
      return { label: 'NF-e', colorPalette: 'blue' };
  }
}

export function formatInvoice(invoice: IInvoiceAPI): IInvoiceAPI {
  return {
    ...invoice,
    company_name: invoice.company.fantasy_name || invoice.company.social_name,
    format_document: invoice.company.document ? formatCNPJ(invoice.company.document) : '',
    format_issued_at: invoice.issued_at ? formatDate(invoice.issued_at) : '',
  };
}

export async function getInvoices(
  params?: IInvoiceParamsRequest,
): Promise<IListResponse<IInvoiceAPI>> {
  const { data } = await api.get<IListResponse<IInvoiceAPI>>(API_URL_INVOICES, { params });
  return { data: data.data.map(formatInvoice), meta: data.meta };
}

export function useInvoices(
  params?: IInvoiceParamsRequest,
  options?: Omit<QueryObserverOptions<IListResponse<IInvoiceAPI>>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: [TABLE_INVOICES, params],
    queryFn: () => getInvoices(params),
    refetchOnWindowFocus: true,
    ...options,
  });
}
