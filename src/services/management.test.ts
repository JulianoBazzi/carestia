import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    invoiceItem: { updateMany: vi.fn() },
    priceObservation: { updateMany: vi.fn() },
    item: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    itemAlias: { updateMany: vi.fn(), upsert: vi.fn() },
    company: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('~/lib/prisma', () => ({ default: prismaMock }));

import { createItem, ignoreItem, mergeItems } from '~/services/management';

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.invoiceItem.updateMany.mockReturnValue('reassign-op');
  prismaMock.priceObservation.updateMany.mockReturnValue('reassign-obs-op');
  prismaMock.item.findFirst.mockResolvedValue({ id: 'target-1', ean: null, nbs_code: null });
  prismaMock.item.findUnique.mockResolvedValue({
    type: 'product',
    reference_code: '22071090',
    name: 'ETANOL HIDRATADO',
    ean: null,
    nbs_code: null,
  });
  prismaMock.item.update.mockReturnValue('update-op');
  prismaMock.item.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.item.deleteMany.mockReturnValue('delete-op');
  prismaMock.item.create.mockResolvedValue({ id: 'item-1' });
  prismaMock.itemAlias.updateMany.mockReturnValue('alias-move-op');
  prismaMock.itemAlias.upsert.mockReturnValue('alias-upsert-op');
  prismaMock.$transaction.mockResolvedValue([]);
});

describe('createItem', () => {
  it('normaliza name, reference_code e unit (UPPERCASE + sem acento)', async () => {
    await createItem({
      type: 'product',
      name: 'café torrado',
      reference_code: 'nc0901',
      unit: 'kg',
    });

    expect(prismaMock.item.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'CAFE TORRADO',
          reference_code: 'NC0901',
          unit: 'KG',
        }),
      }),
    );
  });

  it('grava unit null quando não informado', async () => {
    await createItem({ type: 'product', name: 'arroz', reference_code: '1006' });

    expect(prismaMock.item.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ unit: null }) }),
    );
  });
});

describe('ignoreItem', () => {
  it('marca deleted_at E ignored_at (bloqueio permanente), só em item ativo', async () => {
    const count = await ignoreItem('item-1');

    expect(count).toBe(1);
    expect(prismaMock.item.updateMany).toHaveBeenCalledWith({
      where: { id: 'item-1', deleted_at: null },
      data: { deleted_at: expect.any(Date), ignored_at: expect.any(Date) },
    });
  });

  it('retorna 0 quando o item já está oculto (vira 404 na rota)', async () => {
    prismaMock.item.updateMany.mockResolvedValue({ count: 0 });
    await expect(ignoreItem('item-oculto')).resolves.toBe(0);
  });
});

describe('mergeItems', () => {
  it('rejeita mesclar um item com ele mesmo', async () => {
    await expect(mergeItems('item-1', 'item-1')).rejects.toThrow('Itens iguais.');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejeita quando o destino não existe ou está oculto/ignorado', async () => {
    prismaMock.item.findFirst.mockResolvedValue(null);

    await expect(mergeItems('source-1', 'target-x')).rejects.toThrow(
      'Item de destino não encontrado.',
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejeita quando o item de origem não existe', async () => {
    prismaMock.item.findUnique.mockResolvedValue(null);

    await expect(mergeItems('source-x', 'target-1')).rejects.toThrow(
      'Item de origem não encontrado.',
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('reaponta invoice_items, grava alias do source e o remove definitivamente, em transação', async () => {
    await mergeItems('source-1', 'target-1');

    expect(prismaMock.invoiceItem.updateMany).toHaveBeenCalledWith({
      where: { item_id: 'source-1' },
      data: { item_id: 'target-1' },
    });
    // Observações de preço (etiquetas) também migram para o target.
    expect(prismaMock.priceObservation.updateMany).toHaveBeenCalledWith({
      where: { item_id: 'source-1' },
      data: { item_id: 'target-1' },
    });
    // A identidade do source vira alias do target (o merge mais recente vence
    // se a chave já existir).
    expect(prismaMock.itemAlias.upsert).toHaveBeenCalledWith({
      where: {
        type_reference_code_name: {
          type: 'product',
          reference_code: '22071090',
          name: 'ETANOL HIDRATADO',
        },
      },
      create: {
        id: expect.any(String),
        item_id: 'target-1',
        type: 'product',
        reference_code: '22071090',
        name: 'ETANOL HIDRATADO',
      },
      update: { item_id: 'target-1' },
    });
    // Aliases que apontavam para o source migram para o target (cadeia achatada).
    expect(prismaMock.itemAlias.updateMany).toHaveBeenCalledWith({
      where: { item_id: 'source-1' },
      data: { item_id: 'target-1' },
    });
    // DELETE físico do source (não soft delete): sem risco de reativação futura.
    expect(prismaMock.item.deleteMany).toHaveBeenCalledWith({
      where: { id: 'source-1' },
    });
    expect(prismaMock.item.update).not.toHaveBeenCalled();
    // Todas as operações vão juntas na mesma transação (sem backfill: source sem EAN/NBS).
    expect(prismaMock.$transaction).toHaveBeenCalledWith([
      'reassign-op',
      'reassign-obs-op',
      'alias-move-op',
      'alias-upsert-op',
      'delete-op',
    ]);
  });

  it('faz backfill de EAN/NBS no target quando só o source tem', async () => {
    prismaMock.item.findUnique.mockResolvedValue({
      type: 'product',
      reference_code: '22071090',
      name: 'ETANOL HIDRATADO',
      ean: '7891234567890',
      nbs_code: 'NBS-1',
    });

    await mergeItems('source-1', 'target-1');

    expect(prismaMock.item.updateMany).toHaveBeenCalledWith({
      where: { id: 'target-1', ean: null },
      data: { ean: '7891234567890' },
    });
    expect(prismaMock.item.updateMany).toHaveBeenCalledWith({
      where: { id: 'target-1', nbs_code: null },
      data: { nbs_code: 'NBS-1' },
    });
  });

  it('NÃO faz backfill quando o target já tem EAN próprio', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: 'target-1',
      ean: '7899999999999',
      nbs_code: null,
    });
    prismaMock.item.findUnique.mockResolvedValue({
      type: 'product',
      reference_code: '22071090',
      name: 'ETANOL HIDRATADO',
      ean: '7891234567890',
      nbs_code: null,
    });

    await mergeItems('source-1', 'target-1');

    expect(prismaMock.item.updateMany).not.toHaveBeenCalled();
  });
});
