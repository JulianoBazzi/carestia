import 'server-only';
import prisma from '~/lib/prisma';
import {
  computeInflation,
  computeMetrics,
  type IInflation,
  type IMetrics,
} from '~/services/invoice/analytics';

export interface IListInvoicesParams {
  userId: string;
  type?: 'nfe' | 'nfse';
  from?: Date;
  to?: Date;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listInvoices(params: IListInvoicesParams) {
  const { userId, type, from, to, search, page = 1, pageSize = 20 } = params;

  const where = {
    user_id: userId,
    deleted_at: null,
    ...(type ? { model: type } : {}),
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

export async function getDashboardMetrics(userId: string): Promise<IMetrics> {
  const invoices = await prisma.invoice.findMany({
    where: { user_id: userId, deleted_at: null },
    select: { model: true, issued_at: true, total_value: true },
  });
  return computeMetrics(
    invoices.map((i) => ({
      model: i.model,
      issuedAt: i.issued_at,
      totalValue: i.total_value,
    })),
  );
}

export async function getInflation(userId: string): Promise<IInflation> {
  const lineItems = await prisma.invoiceItem.findMany({
    where: { invoice: { user_id: userId, deleted_at: null } },
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

  return computeInflation(
    lineItems.map((li) => ({
      itemId: li.item.id,
      name: li.item.name,
      referenceCode: li.item.reference_code,
      type: li.item.type,
      categoryName: li.item.category?.name,
      issuedAt: li.invoice.issued_at,
      unitValue: li.unit_value,
    })),
  );
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
