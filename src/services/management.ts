import 'server-only';
import { isValidCNPJ, onlyNumbers } from '@julianobazzi/utils';
import { BusinessError } from '~/lib/errors';
import { newId } from '~/lib/id';
import { normalizeName, slugify } from '~/lib/normalize';
import prisma from '~/lib/prisma';
import { normalizeUnit } from '~/lib/units';

export function listCategories() {
  return prisma.category.findMany({
    where: { deleted_at: null },
    orderBy: { name: 'asc' },
  });
}

export function createCategory(name: string, active = true) {
  const normalized = normalizeName(name);
  if (!normalized) throw new BusinessError('Nome obrigatório.');
  return prisma.category.create({
    data: { id: newId(), name: normalized, slug: slugify(name), active },
  });
}

export async function updateCategory(id: string, name: string, active?: boolean): Promise<number> {
  const normalized = normalizeName(name);
  if (!normalized) throw new BusinessError('Nome obrigatório.');
  const result = await prisma.category.updateMany({
    where: { id, deleted_at: null },
    data: { name: normalized, slug: slugify(name), ...(active !== undefined && { active }) },
  });
  return result.count;
}

/** Contagens para os cards de métrica da tela de categorias. */
export async function getCategoryStats(): Promise<{
  total: number;
  active: number;
  inactive: number;
}> {
  const [total, active] = await Promise.all([
    prisma.category.count({ where: { deleted_at: null } }),
    prisma.category.count({ where: { deleted_at: null, active: true } }),
  ]);
  return { total, active, inactive: total - active };
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

export interface IItemInput {
  type: 'product' | 'service';
  name: string;
  reference_code: string;
  category_id?: string | null;
  unit?: string | null;
}

export function createItem(data: IItemInput) {
  const name = normalizeName(data.name);
  if (!name) throw new BusinessError('Nome obrigatório.');
  const reference_code = normalizeName(data.reference_code);
  if (!reference_code) throw new BusinessError('Código de referência obrigatório.');
  return prisma.item.create({
    data: {
      id: newId(),
      type: data.type,
      name,
      reference_code,
      category_id: data.category_id || null,
      unit: normalizeUnit(data.unit),
    },
  });
}

export async function updateItem(id: string, data: IItemInput): Promise<number> {
  const name = normalizeName(data.name);
  if (!name) throw new BusinessError('Nome obrigatório.');
  const reference_code = normalizeName(data.reference_code);
  if (!reference_code) throw new BusinessError('Código de referência obrigatório.');
  const result = await prisma.item.updateMany({
    where: { id, deleted_at: null },
    data: {
      type: data.type,
      name,
      reference_code,
      category_id: data.category_id || null,
      ...(data.unit !== undefined && { unit: normalizeUnit(data.unit) }),
    },
  });
  return result.count;
}

/**
 * Ignora um item permanentemente: soft delete (some das listagens e agregações,
 * que já filtram `deleted_at`) + `ignored_at`, que impede a importação de
 * recriar/reativar o item (ver `findOrCreateItem`).
 */
export async function ignoreItem(id: string): Promise<number> {
  const now = new Date();
  const result = await prisma.item.updateMany({
    where: { id, deleted_at: null },
    data: { deleted_at: now, ignored_at: now },
  });
  return result.count;
}

/**
 * Mescla dois itens: reaponta os invoice_items do `sourceId` para `targetId`
 * e marca o source como excluído (soft delete). Tudo em transação.
 */
export async function mergeItems(sourceId: string, targetId: string): Promise<void> {
  if (sourceId === targetId) throw new BusinessError('Itens iguais.');
  // Impede mesclar PARA um item oculto/ignorado via API (a UI só lista ativos).
  const target = await prisma.item.findFirst({
    where: { id: targetId, deleted_at: null },
    select: { id: true },
  });
  if (!target) throw new BusinessError('Item de destino não encontrado.');
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
  'number',
  'neighborhood',
  'city',
  'state',
];

function normalizeCompanyData(data: ICompanyUpdate): ICompanyUpdate {
  const normalized: ICompanyUpdate = { ...data };
  for (const field of COMPANY_NAME_FIELDS) {
    if (field in normalized) {
      (normalized as Record<string, unknown>)[field] = normalizeName(normalized[field]) ?? null;
    }
  }
  if ('zipcode' in normalized && normalized.zipcode) {
    normalized.zipcode = onlyNumbers(normalized.zipcode).slice(0, 8) || null;
  }
  return normalized;
}

export async function updateCompany(id: string, data: ICompanyUpdate): Promise<number> {
  const result = await prisma.company.updateMany({
    where: { id, deleted_at: null },
    data: normalizeCompanyData(data),
  });
  return result.count;
}

export interface ICompanyCreate extends ICompanyUpdate {
  document: string;
}

export function createCompany(data: ICompanyCreate) {
  const document = onlyNumbers(data.document);
  if (!isValidCNPJ(document)) throw new BusinessError('CNPJ inválido.');
  const normalized = normalizeCompanyData(data);
  if (!normalized.social_name) throw new BusinessError('Razão social é obrigatória.');
  return prisma.company.create({
    data: {
      id: newId(),
      document,
      origin: 'manual',
      social_name: normalized.social_name,
      fantasy_name: normalized.fantasy_name ?? null,
      street: normalized.street ?? null,
      number: normalized.number ?? null,
      neighborhood: normalized.neighborhood ?? null,
      city: normalized.city ?? null,
      state: normalized.state ?? null,
      zipcode: normalized.zipcode ?? null,
    },
  });
}

export async function deleteCompany(id: string): Promise<number> {
  const result = await prisma.company.updateMany({
    where: { id, deleted_at: null },
    data: { deleted_at: new Date() },
  });
  return result.count;
}
