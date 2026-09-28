import { beforeEach, describe, expect, it, vi } from 'vitest';

// A resolução de itens roda fora de transação e a escrita usa transação em
// array (updateInvoice) ou create aninhado (createInvoiceManual) — o mock
// expõe os delegates direto no client.
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    invoice: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    invoiceItem: { deleteMany: vi.fn(), createMany: vi.fn() },
    // delete só é usado pela purga de nota soft-deletada.
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

/** Nota existente do usuário (sem linhas, sem local) — sobrescreva o que precisar. */
function existingInvoice(overrides: Record<string, unknown> = {}) {
  return { id: 'inv-1', city: null, state: null, ibge_code: null, items: [], ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.invoice.findUnique.mockResolvedValue(null);
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
    prismaMock.invoice.findFirst.mockResolvedValue(existingInvoice());

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

  it('linha inalterada conserva o item casado e o tributo, sem re-casar', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(
      existingInvoice({
        items: [
          {
            id: 'line-1',
            item_id: 'item-do-ean',
            description: 'ARROZ',
            unit: 'UN',
            unit_tax_value: 0.9053,
            item: { reference_code: '1006' },
          },
        ],
      }),
    );

    await updateInvoice('user-1', 'inv-1', {
      ...baseData,
      items: [{ ...baseData.items[0], lineId: 'line-1', unitValue: 26.5 }, baseData.items[1]],
    });

    const rows = prismaMock.invoiceItem.createMany.mock.calls[0][0].data;
    expect(rows[0]).toMatchObject({
      item_id: 'item-do-ean',
      unit_value: 26.5,
      unit_tax_value: 0.9053,
    });
    // Só a linha nova passa pelo matching; linha digitada à mão não tem tributo.
    expect(prismaMock.item.upsert).toHaveBeenCalledTimes(1);
    expect(rows[1].unit_tax_value).toBeNull();
  });

  it('linha com descrição alterada volta ao matching', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(
      existingInvoice({
        items: [
          {
            id: 'line-1',
            item_id: 'item-antigo',
            description: 'ARROZ INTEGRAL',
            unit: 'UN',
            unit_tax_value: null,
            item: { reference_code: '1006' },
          },
        ],
      }),
    );

    await updateInvoice('user-1', 'inv-1', {
      ...baseData,
      items: [{ ...baseData.items[0], lineId: 'line-1' }],
    });

    const rows = prismaMock.invoiceItem.createMany.mock.calls[0][0].data;
    expect(rows[0].item_id).toBe('item-x');
  });

  it('recalcula o IBGE quando a cidade muda e mantém quando não muda', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(
      existingInvoice({ city: 'CUIABA', state: 'MT', ibge_code: '5103403' }),
    );
    await updateInvoice('user-1', 'inv-1', { ...baseData, city: 'Porto Alegre', state: 'RS' });
    expect(prismaMock.invoice.update.mock.calls[0][0].data.ibge_code).toBe('4314902');

    prismaMock.invoice.update.mockClear();
    await updateInvoice('user-1', 'inv-1', { ...baseData, city: 'Cuiabá', state: 'MT' });
    expect(prismaMock.invoice.update.mock.calls[0][0].data.ibge_code).toBe('5103403');
  });

  it('deriva o tipo do item a partir do modelo (nf3e → energy)', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(existingInvoice());

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
    prismaMock.invoice.findFirst.mockResolvedValue(existingInvoice());
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

  it('libera a chave de uma nota excluída antes de recriar', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue({ id: 'old', deleted_at: new Date() });
    prismaMock.invoice.delete.mockReturnValue('purge-invoice-op');

    await createInvoiceManual('user-1', { ...baseData, companyId: 'company-1', accessKey: 'k' });

    expect(prismaMock.invoiceItem.deleteMany).toHaveBeenCalledWith({
      where: { invoice_id: 'old' },
    });
    expect(prismaMock.invoice.delete).toHaveBeenCalledWith({ where: { id: 'old' } });
    expect(prismaMock.invoice.create).toHaveBeenCalledTimes(1);
  });
});
