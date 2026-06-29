import { type QueryObserverOptions, useQuery } from '@tanstack/react-query';
import { API_URL_ITEMS, TABLE_ITEMS } from '~/config/constants';
import type IItemAPI from '~/models/Entity/Item/IItemAPI';
import type IParamsRequest from '~/models/Request/Base/IParamsRequest';
import type IListResponse from '~/models/Response/IListResponse';
import { api } from '~/services/apiClient';

export async function getItems(params?: IParamsRequest): Promise<IListResponse<IItemAPI>> {
  const { data } = await api.get<IListResponse<IItemAPI>>(API_URL_ITEMS, { params });
  return data;
}

export function useItems(
  params?: IParamsRequest,
  options?: Omit<QueryObserverOptions<IListResponse<IItemAPI>>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: [TABLE_ITEMS, params],
    queryFn: () => getItems(params),
    refetchOnWindowFocus: true,
    ...options,
  });
}
