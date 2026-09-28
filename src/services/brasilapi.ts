import { isValidCNPJ, onlyNumbers } from '@julianobazzi/utils';
import axios from 'axios';
import { cacheGetJson, cacheSetJson } from '~/lib/redis';

// CNPJ é dado externo semi-estático; cachear evita a chamada ao BrasilAPI (que
// custava até ~8s por nota na importação). TTL longo — muda raramente.
const CNPJ_CACHE_TTL = 7 * 24 * 60 * 60; // 7 dias

// Falha (API fora, 404, rate limit) também é cacheada, mas por pouco tempo: sem
// isso um lote de 200 notas do mesmo emitente refaz 200 chamadas de até 8s cada
// enquanto a BrasilAPI está indisponível. O TTL curto mantém a retentativa —
// só não uma por nota.
const CNPJ_NEGATIVE_CACHE_TTL = 10 * 60; // 10 minutos

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
  if (!isValidCNPJ(digits)) {
    return null;
  }

  const cacheKey = `cnpj:${digits}`;
  // Sentinela do cache negativo: gravar `null` não serviria — `cacheGetJson`
  // devolve `null` tanto para miss quanto para um `null` gravado.
  const cached = await cacheGetJson<IBrasilApiCnpj | { unavailable: true }>(cacheKey);
  if (cached) {
    return 'unavailable' in cached ? null : cached;
  }

  try {
    const { data } = await client.get<IBrasilApiCnpj>(`/cnpj/v1/${digits}`);
    await cacheSetJson(cacheKey, data, CNPJ_CACHE_TTL);
    return data;
  } catch {
    await cacheSetJson(cacheKey, { unavailable: true }, CNPJ_NEGATIVE_CACHE_TTL);
    return null;
  }
}
