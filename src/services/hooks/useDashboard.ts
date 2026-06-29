import { useQuery } from '@tanstack/react-query';
import { API_URL_DASHBOARD_METRICS, TABLE_DASHBOARD_METRICS } from '~/config/constants';
import type IShowResponse from '~/models/Response/IShowResponse';
import { api } from '~/services/apiClient';
import type { IMetrics } from '~/services/invoice/analytics';

export async function getDashboardMetrics(): Promise<IMetrics> {
  const { data } = await api.get<IShowResponse<IMetrics>>(API_URL_DASHBOARD_METRICS);
  return data.data;
}

export function useDashboardMetrics() {
  return useQuery({
    queryKey: [TABLE_DASHBOARD_METRICS],
    queryFn: getDashboardMetrics,
    refetchOnWindowFocus: true,
  });
}
