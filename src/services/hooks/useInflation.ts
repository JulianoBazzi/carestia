import { useQuery } from '@tanstack/react-query';
import { API_URL_INFLATION, TABLE_INFLATION } from '~/config/constants';
import type IShowResponse from '~/models/Response/IShowResponse';
import { api } from '~/services/apiClient';
import type {
  ICategoryInflation,
  IInflationItem,
  IIpcaComparison,
} from '~/services/invoice/analytics';

export interface IInflationData {
  index: number;
  items: IInflationItem[];
  ipcaAvailable: boolean;
  comparison: IIpcaComparison;
  byCategory: ICategoryInflation[];
}

export async function getInflationData(): Promise<IInflationData> {
  const { data } = await api.get<IShowResponse<IInflationData>>(API_URL_INFLATION);
  return data.data;
}

export function useInflation() {
  return useQuery({
    queryKey: [TABLE_INFLATION],
    queryFn: getInflationData,
    refetchOnWindowFocus: true,
  });
}
