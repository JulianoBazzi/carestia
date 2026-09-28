import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet, store } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  store: new Map<string, string>(),
}));

vi.mock('axios', () => ({
  default: { create: () => ({ get: mockGet }) },
}));

// Cache em memória com a MESMA semântica do Redis (serializa em JSON): é o que
// distingue um miss de um `null` gravado — a razão da sentinela do cache negativo.
vi.mock('~/lib/redis', () => ({
  cacheGetJson: async (key: string) => {
    const raw = store.get(key);
    return raw ? JSON.parse(raw) : null;
  },
  cacheSetJson: async (key: string, value: unknown) => {
    store.set(key, JSON.stringify(value));
  },
}));

import { fetchCnpj } from '~/services/brasilapi';

beforeEach(() => {
  mockGet.mockReset();
  store.clear();
});

describe('fetchCnpj', () => {
  it('retorna dados em sucesso e remove máscara do CNPJ', async () => {
    mockGet.mockResolvedValue({ data: { cnpj: '44092663000159' } });
    const result = await fetchCnpj('44.092.663/0001-59');
    expect(result).toEqual({ cnpj: '44092663000159' });
    expect(mockGet).toHaveBeenCalledWith('/cnpj/v1/44092663000159');
  });

  it('retorna null em falha de rede', async () => {
    mockGet.mockRejectedValue(new Error('timeout'));
    expect(await fetchCnpj('44092663000159')).toBeNull();
  });

  it('serve o CNPJ do cache sem repetir a chamada', async () => {
    mockGet.mockResolvedValue({ data: { cnpj: '44092663000159' } });
    await fetchCnpj('44092663000159');
    const again = await fetchCnpj('44092663000159');
    expect(again).toEqual({ cnpj: '44092663000159' });
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('cacheia a falha: um lote do mesmo emitente não repete a chamada', async () => {
    mockGet.mockRejectedValue(new Error('timeout'));
    expect(await fetchCnpj('44092663000159')).toBeNull();
    expect(await fetchCnpj('44092663000159')).toBeNull();
    expect(await fetchCnpj('44092663000159')).toBeNull();
    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});
