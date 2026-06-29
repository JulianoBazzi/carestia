import 'server-only';
import { newId } from '~/lib/id';
import { normalizeName, slugify } from '~/lib/normalize';
import prisma from '~/lib/prisma';

export function listCategories() {
  return prisma.category.findMany({
    where: { deleted_at: null },
    orderBy: { name: 'asc' },
  });
}

export function createCategory(name: string) {
  const normalized = normalizeName(name);
  if (!normalized) throw new Error('Nome obrigatório.');
  return prisma.category.create({
    data: { id: newId(), name: normalized, slug: slugify(name) },
  });
}

export async function updateCategory(id: string, name: string): Promise<number> {
  const normalized = normalizeName(name);
  if (!normalized) throw new Error('Nome obrigatório.');
  const result = await prisma.category.updateMany({
    where: { id, deleted_at: null },
    data: { name: normalized, slug: slugify(name) },
  });
  return result.count;
}

export async function deleteCategory(id: string): Promise<number> {
  const result = await prisma.category.updateMany({
    where: { id, deleted_at: null },
    data: { deleted_at: new Date() },
  });
  return result.count;
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

const COMPANY_NAME_FIELDS: (keyof ICompanyUpdate)[] = [
  'social_name',
  'fantasy_name',
  'street',
  'neighborhood',
  'city',
];

export async function updateCompany(id: string, data: ICompanyUpdate): Promise<number> {
  const normalized: ICompanyUpdate = { ...data };
  for (const field of COMPANY_NAME_FIELDS) {
    if (field in normalized) {
      (normalized as Record<string, unknown>)[field] = normalizeName(normalized[field]) ?? null;
    }
  }
  const result = await prisma.company.updateMany({
    where: { id, deleted_at: null },
    data: normalized,
  });
  return result.count;
}
