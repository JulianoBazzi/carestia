import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock('axios', () => ({
  default: { create: () => ({ get: mockGet }) },
}));

import { fetchCnpj } from '~/services/brasilapi';

beforeEach(() => {
  mockGet.mockReset();
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
});
