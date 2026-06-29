import { formatDateTime } from '@julianobazzi/utils';
import { type QueryObserverOptions, useQuery } from '@tanstack/react-query';
import { API_URL_CATEGORIES, TABLE_CATEGORIES } from '~/config/constants';
import type ICategoryAPI from '~/models/Entity/Category/ICategoryAPI';
import type IParamsRequest from '~/models/Request/Base/IParamsRequest';
import type IListResponse from '~/models/Response/IListResponse';
import { api } from '~/services/apiClient';
import { queryClient } from '~/services/queryClient';

export function formatCategory(category: ICategoryAPI): ICategoryAPI {
  return {
    ...category,
    format_updated_at: category.updated_at ? formatDateTime(category.updated_at) : '',
  };
}

export async function getCategories(params?: IParamsRequest): Promise<IListResponse<ICategoryAPI>> {
  const { data } = await api.get<IListResponse<ICategoryAPI>>(API_URL_CATEGORIES, { params });
  return { data: data.data.map(formatCategory), meta: data.meta };
}

export function useCategories(
  params?: IParamsRequest,
  options?: Omit<QueryObserverOptions<IListResponse<ICategoryAPI>>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: [TABLE_CATEGORIES, params],
    queryFn: () => getCategories(params),
    refetchOnWindowFocus: true,
    ...options,
  });
}

export async function fetchCategories(params?: IParamsRequest) {
  return queryClient.fetchQuery({
    queryKey: [TABLE_CATEGORIES, params],
    queryFn: () => getCategories(params),
  });
}
