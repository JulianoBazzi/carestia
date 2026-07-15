import { beforeEach, describe, expect, it, vi } from 'vitest';

// A resolução de itens roda fora de transação e a escrita usa transação em
// array (updateInvoice) ou create aninhado (createInvoiceManual) — o mock
// expõe os delegates direto no client.
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    invoice: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    invoiceItem: { deleteMany: vi.fn(), createMany: vi.fn() },
    item: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
    itemAlias: { findUnique: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));

vi.mock('~/lib/prisma', () => ({ default: prismaMock }));

import { createInvoiceManual, updateInvoice } from '~/services/invoice/queries';

const baseData = {
  model: 'nfe' as const,
  number: '10',
  issuedAt: new Date('2026-06-01T00:00:00Z'),
  items: [
    { description: 'Arroz', referenceCode: '1006', unit: 'UN', unitValue: 25.9 },
    { description: 'Feijão', referenceCode: '0713', unit: 'UN', unitValue: 9.5 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$queryRaw.mockResolvedValue([]); // sem candidato parecido → cria via upsert
  prismaMock.item.findMany.mockResolvedValue([]); // nenhum item com o mesmo EAN
  prismaMock.item.findUnique.mockResolvedValue(null); // unique exata sem hit (nem zumbi nem ignorado)
  prismaMock.itemAlias.findUnique.mockResolvedValue(null); // sem nome alternativo (alias de mesclagem)
  prismaMock.item.upsert.mockResolvedValue({ id: 'item-x' });
  prismaMock.invoiceItem.createMany.mockReturnValue('create-many-op');
  prismaMock.invoiceItem.deleteMany.mockReturnValue('delete-op');
  prismaMock.invoice.update.mockReturnValue('update-op');
  prismaMock.invoice.create.mockResolvedValue({ id: 'invoice-1' });
  prismaMock.$transaction.mockResolvedValue([]);
});

describe('updateInvoice', () => {
  it('retorna 0 e não escreve nada quando a nota não é do usuário', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(null);

    const result = await updateInvoice('user-1', 'inv-1', baseData);

    expect(result).toBe(0);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.item.upsert).not.toHaveBeenCalled();
  });

  it('reconcilia recriando os invoice_items (delete + recreate) preservando o preço em R$', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({ id: 'inv-1' });

    const result = await updateInvoice('user-1', 'inv-1', baseData);

    expect(result).toBe(1);
    expect(prismaMock.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inv-1' } }),
    );
    // Apaga os itens antigos e recria em lote, tudo na mesma transação (array).
    expect(prismaMock.invoiceItem.deleteMany).toHaveBeenCalledWith({
      where: { invoice_id: 'inv-1' },
    });
    // Um upsert de Item global por linha (fora da transação).
    expect(prismaMock.item.upsert).toHaveBeenCalledTimes(2);
    const createManyArg = prismaMock.invoiceItem.createMany.mock.calls[0][0];
    expect(createManyArg.data).toHaveLength(2);
    expect(createManyArg.data[0]).toMatchObject({
      invoice_id: 'inv-1',
      unit_value: 25.9,
      description: 'ARROZ',
    });
    expect(prismaMock.$transaction).toHaveBeenCalledWith([
      'update-op',
      'delete-op',
      'create-many-op',
    ]);
  });

  it('deriva o tipo do item a partir do modelo (nf3e → energy)', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({ id: 'inv-1' });

    await updateInvoice('user-1', 'inv-1', { ...baseData, model: 'nf3e' });

    expect(prismaMock.item.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ type: 'energy' }) }),
    );
  });
});

describe('itens ignorados (bloqueio permanente)', () => {
  const ignored = {
    id: 'bloqueado',
    deleted_at: new Date('2026-01-01'),
    ignored_at: new Date('2026-01-01'),
  };

  it('updateInvoice rejeita linha que casa um item ignorado, sem escrever nada', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({ id: 'inv-1' });
    prismaMock.item.findUnique.mockResolvedValue(ignored);

    await expect(updateInvoice('user-1', 'inv-1', baseData)).rejects.toThrow(
      'foi ignorado pela administração',
    );
    // O erro dispara na resolução, antes da transação de escrita.
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.invoiceItem.deleteMany).not.toHaveBeenCalled();
  });

  it('createInvoiceManual rejeita linha que casa um item ignorado, sem criar a nota', async () => {
    prismaMock.item.findUnique.mockResolvedValue(ignored);

    await expect(
      createInvoiceManual('user-1', { ...baseData, companyId: 'company-1', accessKey: 'manual-2' }),
    ).rejects.toThrow('foi ignorado pela administração');
    expect(prismaMock.invoice.create).not.toHaveBeenCalled();
  });
});

describe('createInvoiceManual', () => {
  it('cria a nota com os invoice_items num único create aninhado (atômico)', async () => {
    const id = await createInvoiceManual('user-1', {
      ...baseData,
      companyId: 'company-1',
      accessKey: 'manual-1',
    });

    expect(id).toBe('invoice-1');
    expect(prismaMock.invoice.create).toHaveBeenCalledTimes(1);
    const createArg = prismaMock.invoice.create.mock.calls[0][0].data;
    expect(createArg.items.createMany.data).toHaveLength(2);
    expect(createArg.items.createMany.data[0]).toMatchObject({
      unit_value: 25.9,
      description: 'ARROZ',
    });
  });
});
