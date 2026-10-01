// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, findOrCreateItem } = vi.hoisted(() => ({
  prismaMock: {
    item: { findFirst: vi.fn() },
    priceObservation: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
    },
  },
  findOrCreateItem: vi.fn(),
}));

vi.mock('~/lib/prisma', () => ({ default: prismaMock }));
vi.mock('~/services/invoice/item-matching', () => ({ findOrCreateItem }));

import type { FlyerObservationsInput } from '~/schemas/flyer';
import type { PriceObservationInput } from '~/schemas/price-observation';
import {
  buildFlyerRegions,
  createFlyerObservations,
  createPriceObservation,
  flyerDedupeKey,
} from '~/services/price-observations';

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
  prismaMock.priceObservation.findMany.mockResolvedValue([]);
  prismaMock.priceObservation.createMany.mockResolvedValue({ count: 0 });
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

describe('buildFlyerRegions', () => {
  it('normaliza, remove repetidas e resolve o IBGE pelo nome', () => {
    expect(
      buildFlyerRegions('MS', ['Dourados', 'DOURADOS', 'Naviraí', 'Cidade Inexistente']),
    ).toEqual([
      { city: 'DOURADOS', ibge_code: '5003702' },
      { city: 'NAVIRAI', ibge_code: '5005707' },
      { city: 'CIDADE INEXISTENTE', ibge_code: null },
    ]);
  });

  it('sem cidade, uma região só com a UF', () => {
    expect(buildFlyerRegions('MS', [])).toEqual([{ city: null, ibge_code: null }]);
    expect(buildFlyerRegions('MS', ['  '])).toEqual([{ city: null, ibge_code: null }]);
  });
});

describe('createFlyerObservations', () => {
  const flyer: FlyerObservationsInput = {
    observed_at: '2026-10-01',
    state: 'MS',
    cities: ['Dourados', 'Naviraí'],
    items: [
      {
        item_id: undefined,
        name: 'Arroz Bela Vitta Tipo 1 5kg',
        unit: 'un',
        unit_value: 17.98,
        regular_value: 22.49,
      },
      {
        item_id: '01J0000000000000000000ITEM',
        name: 'Café Pilão 500g',
        unit: undefined,
        unit_value: 20.98,
        regular_value: undefined,
      },
    ],
  };

  beforeEach(() => {
    findOrCreateItem.mockResolvedValue('item-arroz');
    prismaMock.item.findFirst.mockResolvedValue({ id: 'item-cafe', unit: 'UN' });
  });

  it('grava uma observação por item × cidade, com o "de" e source flyer', async () => {
    const result = await createFlyerObservations('admin-1', flyer);

    expect(result).toEqual({ created: 4, skipped: 0, failed: [] });
    expect(findOrCreateItem).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({ reference_code: '', name: 'Arroz Bela Vitta Tipo 1 5kg' }),
    );
    const data = prismaMock.priceObservation.createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(4);
    expect(data[0]).toMatchObject({
      user_id: 'admin-1',
      item_id: 'item-arroz',
      unit_value: 17.98,
      regular_value: 22.49,
      unit: 'UN',
      source: 'flyer',
      city: 'DOURADOS',
      state: 'MS',
      ibge_code: '5003702',
    });
    // Meio-dia BRT do dia da oferta.
    expect(data[0].observed_at.toISOString()).toBe('2026-10-01T15:00:00.000Z');
    // Item escolhido no catálogo herda a unidade dele quando a linha não traz.
    expect(data[2]).toMatchObject({ item_id: 'item-cafe', unit: 'UN', regular_value: null });
  });

  it('pula o que já foi gravado no mesmo dia/região e repetições no envio', async () => {
    prismaMock.priceObservation.findMany.mockResolvedValue([
      { item_id: 'item-arroz', unit_value: '17.9800', city: 'DOURADOS' },
    ]);
    findOrCreateItem.mockResolvedValue('item-arroz');

    const result = await createFlyerObservations('admin-1', {
      ...flyer,
      items: [flyer.items[0], { ...flyer.items[0], name: 'Arroz Bela Vitta 5kg' }],
    });

    // 2 linhas × 2 cidades = 4: Dourados já existia (1) e a 2ª linha repete as duas (2).
    expect(result).toMatchObject({ created: 1, skipped: 3 });
    const where = prismaMock.priceObservation.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ source: 'flyer', state: 'MS', deleted_at: null });
    expect(where.observed_at.gte.toISOString()).toBe('2026-10-01T03:00:00.000Z');
  });

  it('reporta item bloqueado ou inexistente sem derrubar o resto', async () => {
    findOrCreateItem.mockResolvedValue(null);
    prismaMock.item.findFirst.mockResolvedValue(null);

    const result = await createFlyerObservations('admin-1', { ...flyer, cities: [] });

    expect(result.created).toBe(0);
    expect(result.failed.map((f) => f.name)).toEqual([
      'Arroz Bela Vitta Tipo 1 5kg',
      'Café Pilão 500g',
    ]);
    expect(prismaMock.priceObservation.createMany).not.toHaveBeenCalled();
  });

  it('a chave de dedupe usa o preço na precisão da coluna', () => {
    expect(flyerDedupeKey('i', 17.98, null)).toBe(flyerDedupeKey('i', Number('17.9800'), null));
  });
});
