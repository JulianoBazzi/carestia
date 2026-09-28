// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, findOrCreateItem } = vi.hoisted(() => ({
  prismaMock: {
    item: { findFirst: vi.fn() },
    priceObservation: { findFirst: vi.fn(), create: vi.fn() },
  },
  findOrCreateItem: vi.fn(),
}));

vi.mock('~/lib/prisma', () => ({ default: prismaMock }));
vi.mock('~/services/invoice/item-matching', () => ({ findOrCreateItem }));

import type { PriceObservationInput } from '~/schemas/price-observation';
import { createPriceObservation } from '~/services/price-observations';

const input: PriceObservationInput = {
  ean: '036000291452',
  name: 'Leite Condensado 395g',
  unit: 'un',
  unit_value: 7.49,
  city: 'São Paulo',
  state: 'SP',
  ibge_code: undefined,
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.item.findFirst.mockResolvedValue(null);
  prismaMock.priceObservation.findFirst.mockResolvedValue(null);
  prismaMock.priceObservation.create.mockResolvedValue({ id: 'obs-1' });
  findOrCreateItem.mockResolvedValue('item-1');
});

describe('createPriceObservation', () => {
  it('grava só preço unitário + cidade/UF, resolvendo o IBGE pelo nome', async () => {
    const result = await createPriceObservation('user-1', input);

    expect(result).toEqual({ id: 'obs-1', itemId: 'item-1' });
    const data = prismaMock.priceObservation.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      user_id: 'user-1',
      item_id: 'item-1',
      unit_value: 7.49,
      unit: 'UN',
      source: 'label_photo',
      city: 'SAO PAULO',
      state: 'SP',
      ibge_code: '3550308',
    });
    expect(data.observed_at).toBeInstanceOf(Date);
  });

  it('ignora IBGE do client que não pertence à UF informada', async () => {
    // 3304557 = Rio de Janeiro/RJ; cidade digitada não existe em SP.
    await createPriceObservation('user-1', {
      ...input,
      city: 'Cidade Inexistente',
      ibge_code: '3304557',
    });
    expect(prismaMock.priceObservation.create.mock.calls[0][0].data.ibge_code).toBeNull();
  });

  it('cria o item no bucket sem NCM, com o nome normalizado', async () => {
    await createPriceObservation('user-1', input);

    expect(findOrCreateItem).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({
        type: 'product',
        reference_code: '',
        name: 'LEITE CONDENSADO 395G',
        ean: '036000291452',
        unitValue: 7.49,
      }),
    );
  });

  it('reaproveita o EAN e o nome como estão no catálogo (variante com zero à esquerda)', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      name: 'LEITE CONDENSADO MOCA 395G',
      ean: '0036000291452',
      unit: 'UN',
    });

    await createPriceObservation('user-1', { ...input, name: undefined });

    expect(prismaMock.item.findFirst.mock.calls[0][0].where.ean.in).toContain('0036000291452');
    expect(findOrCreateItem).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({ name: 'LEITE CONDENSADO MOCA 395G', ean: '0036000291452' }),
    );
  });

  it('recusa EAN desconhecido sem nome (422)', async () => {
    await expect(
      createPriceObservation('user-1', { ...input, name: undefined }),
    ).rejects.toMatchObject({ status: 422 });
    expect(findOrCreateItem).not.toHaveBeenCalled();
  });

  it('recusa item bloqueado no catálogo (422)', async () => {
    findOrCreateItem.mockResolvedValue(null);
    await expect(createPriceObservation('user-1', input)).rejects.toMatchObject({ status: 422 });
    expect(prismaMock.priceObservation.create).not.toHaveBeenCalled();
  });

  it('é idempotente: reenvio recente do mesmo item+preço não duplica', async () => {
    prismaMock.priceObservation.findFirst.mockResolvedValue({ id: 'obs-existing' });

    const result = await createPriceObservation('user-1', input);

    expect(result.id).toBe('obs-existing');
    expect(prismaMock.priceObservation.create).not.toHaveBeenCalled();
    const where = prismaMock.priceObservation.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ user_id: 'user-1', item_id: 'item-1', unit_value: 7.49 });
  });
});
