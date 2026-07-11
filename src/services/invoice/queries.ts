import 'server-only';
import { newId } from '~/lib/id';
import { normalizeName } from '~/lib/normalize';
import prisma from '~/lib/prisma';
import { normalizeUnit } from '~/lib/units';
import type { IInflationRow } from '~/services/invoice/analytics';
import { findOrCreateItem } from '~/services/invoice/item-matching';

export type InvoiceModelStr = 'nfe' | 'nfce' | 'nfse' | 'nf3e';

/** Tipo do item derivado do modelo da nota. */
export function modelToItemType(model: InvoiceModelStr): 'product' | 'service' | 'energy' {
  if (model === 'nf3e') return 'energy';
  if (model === 'nfse') return 'service';
  return 'product';
}

export interface IInvoiceItemInput {
  description: string;
  referenceCode: string;
  unit?: string | null;
  unitValue: number; // reais (R$/un, R$/kWh)
}

export interface IInvoiceWriteInput {
  model: InvoiceModelStr;
  number: string;
  series?: string | null;
  issuedAt: Date;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  items: IInvoiceItemInput[];
}

/** Upsert do Item global + retorno do invoice_item a criar (privacy-first: só preço unitário). */
async function buildLineItems(
  // biome-ignore lint/suspicious/noExplicitAny: client de transação do Prisma
  tx: any,
  invoiceId: string,
  itemType: 'product' | 'service' | 'energy',
  items: IInvoiceItemInput[],
) {
  for (const it of items) {
    const name = normalizeName(it.description) ?? it.description;
    const unit = normalizeUnit(it.unit);
    // Reaproveita item existente parecido (pg_trgm) em vez de duplicar por variação de nome.
    // O findOrCreateItem normaliza name/reference_code/unit internamente.
    const itemId = await findOrCreateItem(tx, {
      type: itemType,
      reference_code: it.referenceCode,
      name: it.description,
      unit,
    });
    await tx.invoiceItem.create({
      data: {
        id: newId(),
        invoice_id: invoiceId,
        item_id: itemId,
        description: name,
        unit,
        unit_value: it.unitValue,
      },
    });
  }
}

/** Edita metadados + local + itens de uma nota (reconcilia recriando os invoice_items). */
export async function updateInvoice(
  userId: string,
  id: string,
  data: IInvoiceWriteInput,
): Promise<number> {
  const existing = await prisma.invoice.findFirst({
    where: { id, user_id: userId, deleted_at: null },
    select: { id: true },
  });
  if (!existing) return 0;

  const itemType = modelToItemType(data.model);
  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id },
      data: {
        model: data.model,
        number: normalizeName(data.number) ?? data.number,
        series: normalizeName(data.series) ?? null,
        issued_at: data.issuedAt,
        neighborhood: normalizeName(data.neighborhood) ?? null,
        city: normalizeName(data.city) ?? null,
        state: normalizeName(data.state) ?? null,
      },
    });
    await tx.invoiceItem.deleteMany({ where: { invoice_id: id } });
    await buildLineItems(tx, id, itemType, data.items);
  });
  return 1;
}

/** Cria uma nota manualmente (entrada manual / conta de energia). */
export async function createInvoiceManual(
  userId: string,
  data: IInvoiceWriteInput & { companyId: string; accessKey: string },
): Promise<string> {
  const itemType = modelToItemType(data.model);
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.create({
      data: {
        id: newId(),
        user_id: userId,
        company_id: data.companyId,
        model: data.model,
        number: normalizeName(data.number) ?? data.number,
        series: normalizeName(data.series) ?? null,
        access_key: data.accessKey,
        issued_at: data.issuedAt,
        neighborhood: normalizeName(data.neighborhood) ?? null,
        city: normalizeName(data.city) ?? null,
        state: normalizeName(data.state) ?? null,
      },
    });
    await buildLineItems(tx, invoice.id, itemType, data.items);
    return invoice.id;
  });
}

export interface IListInvoicesParams {
  userId: string;
  type?: 'nfe' | 'nfce' | 'nfse' | 'nf3e';
  from?: Date;
  to?: Date;
  search?: string;
  companyId?: string;
  page?: number;
  pageSize?: number;
}

export async function listInvoices(params: IListInvoicesParams) {
  const { userId, type, from, to, search, companyId, page = 1, pageSize = 20 } = params;

  const where = {
    user_id: userId,
    deleted_at: null,
    ...(type ? { model: type } : {}),
    ...(companyId ? { company_id: companyId } : {}),
    ...(from || to
      ? { issued_at: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {}),
    ...(search
      ? {
          OR: [
            { company: { social_name: { contains: search, mode: 'insensitive' as const } } },
            { company: { fantasy_name: { contains: search, mode: 'insensitive' as const } } },
            {
              items: {
                some: { item: { name: { contains: search, mode: 'insensitive' as const } } },
              },
            },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: { company: true, _count: { select: { items: true } } },
      orderBy: { issued_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.invoice.count({ where }),
  ]);

  return { rows, total, page, pageSize };
}

export async function getInvoice(userId: string, id: string) {
  return prisma.invoice.findFirst({
    where: { id, user_id: userId, deleted_at: null },
    include: { company: true, items: { include: { item: true } } },
  });
}

export async function softDeleteInvoice(userId: string, id: string): Promise<number> {
  const result = await prisma.invoice.updateMany({
    where: { id, user_id: userId, deleted_at: null },
    data: { deleted_at: new Date() },
  });
  return result.count;
}

/** Pontos de preço unitário (R$) por item, base para inflação/série mensal/comparação IPCA. */
export async function getInflationRows(userId: string): Promise<IInflationRow[]> {
  const lineItems = await prisma.invoiceItem.findMany({
    // Exclui itens soft-deletados (ex.: mesclados) — não devem contar na inflação.
    where: { item: { deleted_at: null }, invoice: { user_id: userId, deleted_at: null } },
    select: {
      unit_value: true,
      item: {
        select: {
          id: true,
          name: true,
          reference_code: true,
          type: true,
          category: { select: { name: true } },
        },
      },
      invoice: { select: { issued_at: true } },
    },
  });

  return lineItems.map((li) => ({
    itemId: li.item.id,
    name: li.item.name,
    referenceCode: li.item.reference_code,
    type: li.item.type,
    categoryName: li.item.category?.name,
    issuedAt: li.invoice.issued_at,
    unitValue: Number(li.unit_value),
  }));
}

/** Menor e maior data de emissão das notas do usuário (para janela do IPCA). */
export async function getInvoiceDateRange(
  userId: string,
): Promise<{ from: Date; to: Date } | null> {
  const agg = await prisma.invoice.aggregate({
    where: { user_id: userId, deleted_at: null },
    _min: { issued_at: true },
    _max: { issued_at: true },
  });
  if (!agg._min.issued_at || !agg._max.issued_at) return null;
  return { from: agg._min.issued_at, to: agg._max.issued_at };
}
