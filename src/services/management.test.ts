import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    invoiceItem: { updateMany: vi.fn() },
    item: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    company: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('~/lib/prisma', () => ({ default: prismaMock }));

import { createItem, ignoreItem, mergeItems } from '~/services/management';

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.invoiceItem.updateMany.mockReturnValue('reassign-op');
  prismaMock.item.findFirst.mockResolvedValue({ id: 'target-1' });
  prismaMock.item.update.mockReturnValue('soft-delete-op');
  prismaMock.item.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.item.create.mockResolvedValue({ id: 'item-1' });
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

  it('reaponta os invoice_items do source p/ o target e soft-deleta o source, em transação', async () => {
    await mergeItems('source-1', 'target-1');

    expect(prismaMock.invoiceItem.updateMany).toHaveBeenCalledWith({
      where: { item_id: 'source-1' },
      data: { item_id: 'target-1' },
    });
    expect(prismaMock.item.update).toHaveBeenCalledWith({
      where: { id: 'source-1' },
      data: { deleted_at: expect.any(Date) },
    });
    // As duas operações vão juntas na mesma transação.
    expect(prismaMock.$transaction).toHaveBeenCalledWith(['reassign-op', 'soft-delete-op']);
  });
});
