import { isValidCNPJ, onlyNumbers } from '@julianobazzi/utils';
import axios from 'axios';
import { cacheGetJson, cacheSetJson } from '~/lib/redis';

// CNPJ é dado externo semi-estático; cachear evita a chamada ao BrasilAPI (que
// custava até ~8s por nota na importação). TTL longo — muda raramente.
const CNPJ_CACHE_TTL = 7 * 24 * 60 * 60; // 7 dias

export interface IBrasilApiCnpj {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  complemento: string;
  cnae_fiscal: number;
  cnae_fiscal_descricao: string;
}

const client = axios.create({
  baseURL: 'https://brasilapi.com.br/api',
  timeout: 8000,
});

/** Fetches CNPJ data from BrasilAPI. Returns null on failure. */
export async function fetchCnpj(cnpj: string): Promise<IBrasilApiCnpj | null> {
  const digits = onlyNumbers(cnpj);
  if (!isValidCNPJ(digits)) return null;

  const cacheKey = `cnpj:${digits}`;
  const cached = await cacheGetJson<IBrasilApiCnpj>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const { data } = await client.get<IBrasilApiCnpj>(`/cnpj/v1/${digits}`);
    // Só sucesso é cacheado — falhas devem ser retentadas no próximo import.
    await cacheSetJson(cacheKey, data, CNPJ_CACHE_TTL);
    return data;
  } catch {
    return null;
  }
}
