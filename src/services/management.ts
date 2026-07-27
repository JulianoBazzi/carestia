import 'server-only';
import { isValidCNPJ, onlyNumbers } from '@julianobazzi/utils';
import { BusinessError } from '~/lib/errors';
import { newId } from '~/lib/id';
import { normalizeName, slugify } from '~/lib/normalize';
import prisma from '~/lib/prisma';
import { cacheDel } from '~/lib/redis';
import { normalizeUnit } from '~/lib/units';

// Invalida o cache de empresa (chave por documento) usado no import. Como as
// mutações vêm por id, buscamos o documento antes de remover a chave.
async function invalidateCompanyCache(id: string): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id },
    select: { document: true },
  });
  if (company) {
    await cacheDel(`company:${company.document}`);
  }
}

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
  /**
   * NCM (produto) | cTribNac (serviço). OPCIONAL: a NFC-e consultada na
   * Infosimples não expõe NCM, e esses itens entram no catálogo com o código
   * vazio — exigi-lo aqui impediria renomear/categorizar um item importado sem
   * inventar um NCM. O código continua podendo ser preenchido depois.
   */
  reference_code?: string | null;
  category_id?: string | null;
  unit?: string | null;
}

export function createItem(data: IItemInput) {
  const name = normalizeName(data.name);
  if (!name) throw new BusinessError('Nome obrigatório.');
  const reference_code = normalizeName(data.reference_code) ?? '';
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
  const reference_code = normalizeName(data.reference_code) ?? '';
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
 * Mescla dois itens: reaponta os invoice_items do `sourceId` para `targetId`,
 * grava a identidade do source como alias do target (para a importação cair no
 * target em vez de recriar a duplicata — ver `findOrCreateItem`), migra os
 * aliases que o source já tinha e REMOVE o source definitivamente.
 * Tudo em transação.
 */
export async function mergeItems(sourceId: string, targetId: string): Promise<void> {
  if (sourceId === targetId) throw new BusinessError('Itens iguais.');
  // Impede mesclar PARA um item oculto/ignorado via API (a UI só lista ativos).
  const target = await prisma.item.findFirst({
    where: { id: targetId, deleted_at: null },
    select: { id: true, ean: true, nbs_code: true },
  });
  if (!target) throw new BusinessError('Item de destino não encontrado.');
  const source = await prisma.item.findUnique({
    where: { id: sourceId },
    select: { type: true, reference_code: true, name: true, ean: true, nbs_code: true },
  });
  if (!source) throw new BusinessError('Item de origem não encontrado.');
  await prisma.$transaction([
    prisma.invoiceItem.updateMany({
      where: { item_id: sourceId },
      data: { item_id: targetId },
    }),
    // Aliases que já apontavam para o source migram junto — cadeias A→B→C
    // ficam achatadas: todo alias aponta direto para um item vivo.
    prisma.itemAlias.updateMany({
      where: { item_id: sourceId },
      data: { item_id: targetId },
    }),
    // Se a chave já existe (merge antigo cuja identidade foi recriada), o
    // merge mais recente vence.
    prisma.itemAlias.upsert({
      where: {
        type_reference_code_name: {
          type: source.type,
          reference_code: source.reference_code,
          name: source.name,
        },
      },
      create: {
        id: newId(),
        item_id: targetId,
        type: source.type,
        reference_code: source.reference_code,
        name: source.name,
      },
      update: { item_id: targetId },
    }),
    // DELETE físico (exceção consciente à convenção de soft delete): todas as
    // referências já foram reapontadas acima e o alias preserva a identidade —
    // manter a linha só deixaria uma via de reativação indevida na importação.
    // `deleteMany` para ser no-op (e não P2025) se dois merges correrem juntos.
    prisma.item.deleteMany({
      where: { id: sourceId },
    }),
    // Backfill: o target herda EAN/NBS do source quando não tem os próprios,
    // para o atalho por EAN da importação acertar o item vivo. O filtro
    // `ean: null` torna a operação no-op se algo preencher no meio do caminho.
    ...(source.ean && !target.ean
      ? [prisma.item.updateMany({ where: { id: targetId, ean: null }, data: { ean: source.ean } })]
      : []),
    ...(source.nbs_code && !target.nbs_code
      ? [
          prisma.item.updateMany({
            where: { id: targetId, nbs_code: null },
            data: { nbs_code: source.nbs_code },
          }),
        ]
      : []),
  ]);
}

/** Lista os nomes alternativos (aliases) de um item, em ordem alfabética. */
export function listItemAliases(itemId: string) {
  return prisma.itemAlias.findMany({
    where: { item_id: itemId },
    orderBy: { name: 'asc' },
  });
}

/**
 * Adiciona um nome alternativo a um item ativo. O alias usa o tipo do item e,
 * por padrão, o mesmo reference_code (NCM/cTribNac) — a importação só consulta
 * aliases dentro do mesmo tipo+código. Unicidade global da chave
 * (type+code+name) fica por conta da constraint (P2002 → 409 na rota).
 */
export async function createItemAlias(itemId: string, name: string, referenceCode?: string | null) {
  const normalized = normalizeName(name);
  if (!normalized) throw new BusinessError('Nome obrigatório.');
  const item = await prisma.item.findFirst({
    where: { id: itemId, deleted_at: null },
    select: { type: true, reference_code: true },
  });
  if (!item) throw new BusinessError('Item não encontrado.', 404);
  const refCode = normalizeName(referenceCode) ?? item.reference_code;
  // Um alias com a identidade de um item ATIVO desviaria as importações dele —
  // o caminho certo nesse caso é a mesclagem (que oculta o item e cria o alias).
  const conflict = await prisma.item.findUnique({
    where: {
      type_reference_code_name: { type: item.type, reference_code: refCode, name: normalized },
    },
    select: { id: true, deleted_at: true },
  });
  if (conflict && !conflict.deleted_at) {
    throw new BusinessError(
      conflict.id === itemId
        ? 'O item já usa este nome.'
        : 'Já existe um item ativo com este nome — use a mesclagem.',
    );
  }
  return prisma.itemAlias.create({
    data: {
      id: newId(),
      item_id: itemId,
      type: item.type,
      reference_code: refCode,
      name: normalized,
    },
  });
}

/** Remove um nome alternativo do item. Retorna o nº de linhas (0 → 404 na rota). */
export async function deleteItemAlias(itemId: string, aliasId: string): Promise<number> {
  const result = await prisma.itemAlias.deleteMany({
    where: { id: aliasId, item_id: itemId },
  });
  return result.count;
}

export function getCompany(id: string) {
  return prisma.company.findFirst({ where: { id, deleted_at: null } });
}

export interface ICompanyUpdate {
  social_name?: string;
  fantasy_name?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
}

const COMPANY_NAME_FIELDS: (keyof ICompanyUpdate)[] = [
  'social_name',
  'fantasy_name',
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
  return normalized;
}

export async function updateCompany(id: string, data: ICompanyUpdate): Promise<number> {
  const result = await prisma.company.updateMany({
    where: { id, deleted_at: null },
    data: normalizeCompanyData(data),
  });
  if (result.count > 0) {
    await invalidateCompanyCache(id);
  }
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
      neighborhood: normalized.neighborhood ?? null,
      city: normalized.city ?? null,
      state: normalized.state ?? null,
    },
  });
}

export async function deleteCompany(id: string): Promise<number> {
  const result = await prisma.company.updateMany({
    where: { id, deleted_at: null },
    data: { deleted_at: new Date() },
  });
  if (result.count > 0) {
    await invalidateCompanyCache(id);
  }
  return result.count;
}
