import { isValidCNPJ, onlyNumbers } from '@julianobazzi/utils';
import axios from 'axios';

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
  try {
    const { data } = await client.get<IBrasilApiCnpj>(`/cnpj/v1/${digits}`);
    return data;
  } catch {
    return null;
  }
}
