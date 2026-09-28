import { useQuery } from '@tanstack/react-query';
import { API_URL_PUBLIC_PRICES, TABLE_PUBLIC_PRICES } from '~/config/constants';
import { api } from '~/services/apiClient';
// Import só de tipos: o módulo é `server-only`, mas tipos são apagados no build.
import type { IEanPriceResult } from '~/services/public-prices';

export interface IEanRegionParams {
  city?: string | null;
  state?: string | null;
  ibge_code?: string | null;
}

export async function getEanPrice(
  ean: string,
  region: IEanRegionParams = {},
): Promise<IEanPriceResult> {
  const { data } = await api.get<{ data: IEanPriceResult }>(
    `${API_URL_PUBLIC_PRICES}/ean/${encodeURIComponent(ean)}`,
    {
      params: {
        city: region.city || undefined,
        state: region.state || undefined,
        ibge_code: region.ibge_code || undefined,
      },
    },
  );
  return data.data;
}

/** Preço de um produto pelo código de barras nos recortes cidade/UF/Brasil. */
export function useEanPrice(ean: string | null, region: IEanRegionParams = {}) {
  return useQuery({
    queryKey: [
      TABLE_PUBLIC_PRICES,
      'ean',
      ean,
      region.state ?? null,
      region.city ?? null,
      region.ibge_code ?? null,
    ],
    queryFn: () => getEanPrice(ean as string, region),
    enabled: Boolean(ean),
  });
}
