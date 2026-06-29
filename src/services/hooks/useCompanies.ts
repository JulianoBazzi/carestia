import { formatCNPJ } from '@julianobazzi/utils';
import { type QueryObserverOptions, useQuery } from '@tanstack/react-query';
import { API_URL_COMPANIES, TABLE_COMPANIES } from '~/config/constants';
import type ICompanyAPI from '~/models/Entity/Company/ICompanyAPI';
import type IParamsRequest from '~/models/Request/Base/IParamsRequest';
import type IListResponse from '~/models/Response/IListResponse';
import type IShowResponse from '~/models/Response/IShowResponse';
import { api } from '~/services/apiClient';

export function formatCompany(company: ICompanyAPI): ICompanyAPI {
  return {
    ...company,
    format_document: company.document ? formatCNPJ(company.document) : '',
  };
}

export async function getCompanies(params?: IParamsRequest): Promise<IListResponse<ICompanyAPI>> {
  const { data } = await api.get<IListResponse<ICompanyAPI>>(API_URL_COMPANIES, { params });
  return { data: data.data.map(formatCompany), meta: data.meta };
}

export async function getCompany(id: string): Promise<ICompanyAPI> {
  const { data } = await api.get<IShowResponse<ICompanyAPI>>(`${API_URL_COMPANIES}/${id}`);
  return formatCompany(data.data);
}

export function useCompanies(
  params?: IParamsRequest,
  options?: Omit<QueryObserverOptions<IListResponse<ICompanyAPI>>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: [TABLE_COMPANIES, params],
    queryFn: () => getCompanies(params),
    refetchOnWindowFocus: true,
    ...options,
  });
}
