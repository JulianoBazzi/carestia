import 'server-only';
import prisma from '~/lib/prisma';

export function listCategories() {
  return prisma.category.findMany({
    where: { deleted_at: null },
    orderBy: { name: 'asc' },
  });
}

export function listItems() {
  return prisma.item.findMany({
    where: { deleted_at: null },
    include: {
      category: { select: { id: true, name: true } },
      _count: { select: { invoice_items: true } },
    },
    orderBy: { name: 'asc' },
  });
}

export async function setItemCategory(itemId: string, categoryId: string | null): Promise<number> {
  const result = await prisma.item.updateMany({
    where: { id: itemId, deleted_at: null },
    data: { category_id: categoryId },
  });
  return result.count;
}

/**
 * Mescla dois itens: reaponta os invoice_items do `sourceId` para `targetId`
 * e marca o source como excluído (soft delete). Tudo em transação.
 */
export async function mergeItems(sourceId: string, targetId: string): Promise<void> {
  if (sourceId === targetId) throw new Error('Itens iguais.');
  await prisma.$transaction([
    prisma.invoiceItem.updateMany({
      where: { item_id: sourceId },
      data: { item_id: targetId },
    }),
    prisma.item.update({
      where: { id: sourceId },
      data: { deleted_at: new Date() },
    }),
  ]);
}

export function getCompany(id: string) {
  return prisma.company.findFirst({ where: { id, deleted_at: null } });
}

export interface ICompanyUpdate {
  social_name?: string;
  fantasy_name?: string | null;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zipcode?: string | null;
}

export async function updateCompany(id: string, data: ICompanyUpdate): Promise<number> {
  const result = await prisma.company.updateMany({
    where: { id, deleted_at: null },
    data,
  });
  return result.count;
}
