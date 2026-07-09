import { beforeEach, describe, expect, it, vi } from 'vitest';

const { tx, prismaMock } = vi.hoisted(() => {
  const tx = {
    invoice: { update: vi.fn(), create: vi.fn() },
    invoiceItem: { deleteMany: vi.fn(), create: vi.fn() },
    item: { upsert: vi.fn() },
  };
  return {
    tx,
    prismaMock: {
      invoice: { findFirst: vi.fn() },
      $transaction: vi.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    },
  };
});

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
  prismaMock.$transaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
  tx.item.upsert.mockResolvedValue({ id: 'item-x' });
  tx.invoiceItem.create.mockResolvedValue({});
  tx.invoiceItem.deleteMany.mockResolvedValue({ count: 0 });
  tx.invoice.update.mockResolvedValue({});
  tx.invoice.create.mockResolvedValue({ id: 'invoice-1' });
});

describe('updateInvoice', () => {
  it('retorna 0 e não abre transação quando a nota não é do usuário', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(null);

    const result = await updateInvoice('user-1', 'inv-1', baseData);

    expect(result).toBe(0);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('reconcilia recriando os invoice_items (delete + recreate) preservando o preço em R$', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({ id: 'inv-1' });

    const result = await updateInvoice('user-1', 'inv-1', baseData);

    expect(result).toBe(1);
    expect(tx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inv-1' } }),
    );
    // Apaga os itens antigos antes de recriar.
    expect(tx.invoiceItem.deleteMany).toHaveBeenCalledWith({ where: { invoice_id: 'inv-1' } });
    // Um upsert de Item global e um invoice_item por linha.
    expect(tx.item.upsert).toHaveBeenCalledTimes(2);
    expect(tx.invoiceItem.create).toHaveBeenCalledTimes(2);
    expect(tx.invoiceItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ unit_value: 25.9, description: 'ARROZ' }),
      }),
    );
  });

  it('deriva o tipo do item a partir do modelo (nf3e → energy)', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({ id: 'inv-1' });

    await updateInvoice('user-1', 'inv-1', { ...baseData, model: 'nf3e' });

    expect(tx.item.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ type: 'energy' }) }),
    );
  });
});

describe('createInvoiceManual', () => {
  it('cria a nota e os invoice_items na mesma transação', async () => {
    const id = await createInvoiceManual('user-1', {
      ...baseData,
      companyId: 'company-1',
      accessKey: 'manual-1',
    });

    expect(id).toBe('invoice-1');
    expect(tx.invoice.create).toHaveBeenCalledTimes(1);
    expect(tx.invoiceItem.create).toHaveBeenCalledTimes(2);
  });
});
