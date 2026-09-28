import 'server-only';
import type { Prisma } from '~/generated/prisma/client';
import { BusinessError } from '~/lib/errors';
import { findMunicipioByName } from '~/lib/geo/municipios';
import { newId } from '~/lib/id';
import { normalizeName } from '~/lib/normalize';
import prisma from '~/lib/prisma';
import { normalizeUnit } from '~/lib/units';
import type { IInflationRow } from '~/services/invoice/analytics';
import { findOrCreateItem } from '~/services/invoice/item-matching';

export type InvoiceModelStr = 'nfe' | 'nfce' | 'nfse' | 'nf3e';

/** Tipo do item derivado do modelo da nota. */
export function modelToItemType(model: InvoiceModelStr): 'product' | 'service' | 'energy' {
  if (model === 'nf3e') {
    return 'energy';
  }
  if (model === 'nfse') {
    return 'service';
  }
  return 'product';
}

export interface IInvoiceItemInput {
  /** Id da linha existente (edição) — preserva o item casado quando nada mudou. */
  lineId?: string | null;
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

/**
 * Resolve os Itens globais e monta as rows de invoice_item (privacy-first: só
 * preço unitário). Roda FORA de transação de propósito: o matching faz várias
 * queries por linha (EAN, similaridade, alias) e estourava o timeout da
 * transação interativa; itens criados são catálogo global — persistir mesmo
 * que a nota falhe depois é inofensivo (o matching os reutiliza).
 */
async function resolveLineItems(
  itemType: 'product' | 'service' | 'energy',
  items: IInvoiceItemInput[],
  previous: Map<string, IPreviousLine> = new Map(),
) {
  const rows = [];
  for (const it of items) {
    const name = normalizeName(it.description) ?? it.description;
    const unit = normalizeUnit(it.unit);
    const referenceCode = normalizeName(it.referenceCode) ?? it.referenceCode;

    // Edição: linha que mantém descrição, código e unidade conserva o item já
    // casado (que pode ter vindo do EAN na importação) e o tributo por unidade —
    // re-casar pela descrição mudaria o item e partiria o histórico de preço.
    const prev = it.lineId ? previous.get(it.lineId) : undefined;
    if (
      prev &&
      prev.description === name &&
      prev.unit === unit &&
      prev.referenceCode === referenceCode
    ) {
      rows.push({
        id: newId(),
        item_id: prev.itemId,
        description: name,
        unit,
        unit_value: it.unitValue,
        unit_tax_value: prev.unitTaxValue,
      });
      continue;
    }

    // Reaproveita item existente parecido (pg_trgm) em vez de duplicar por variação de nome.
    // O findOrCreateItem normaliza name/reference_code/unit internamente.
    const itemId = await findOrCreateItem(prisma, {
      type: itemType,
      reference_code: it.referenceCode,
      name: it.description,
      unit,
      unitValue: it.unitValue,
    });
    // Diferente da importação de XML (que só pula a linha), aqui o usuário
    // digitou o item — descartar em silêncio seria perda invisível de dados.
    if (itemId === null) {
      throw new BusinessError(
        `O item "${name}" foi ignorado pela administração e não pode ser usado em notas.`,
      );
    }
    rows.push({
      id: newId(),
      item_id: itemId,
      description: name,
      unit,
      unit_value: it.unitValue,
      // Tributo aproximado só vem do XML — linha nova/alterada à mão fica sem.
      unit_tax_value: null,
    });
  }
  return rows;
}

interface IPreviousLine {
  itemId: string;
  description: string;
  unit: string | null;
  referenceCode: string;
  unitTaxValue: Prisma.Decimal | null;
}

/**
 * Remove de vez uma nota soft-deletada (e suas linhas) para liberar a chave de
 * acesso — a unique (user_id, access_key) inclui as excluídas. Só guardamos
 * preço unitário, então não há histórico a preservar.
 */
export async function purgeDeletedInvoice(invoiceId: string): Promise<void> {
  await prisma.$transaction([
    prisma.invoiceItem.deleteMany({ where: { invoice_id: invoiceId } }),
    prisma.invoice.delete({ where: { id: invoiceId } }),
  ]);
}

/** IBGE do local digitado; `null` quando o nome não bate com um município da UF. */
function ibgeFor(state?: string | null, city?: string | null): string | null {
  return findMunicipioByName(state, city)?.ibge_code ?? null;
}

/** Edita metadados + local + itens de uma nota (reconcilia recriando os invoice_items). */
export async function updateInvoice(
  userId: string,
  id: string,
  data: IInvoiceWriteInput,
): Promise<number> {
  const existing = await prisma.invoice.findFirst({
    where: { id, user_id: userId, deleted_at: null },
    select: {
      id: true,
      city: true,
      state: true,
      ibge_code: true,
      items: {
        select: {
          id: true,
          item_id: true,
          description: true,
          unit: true,
          unit_tax_value: true,
          item: { select: { reference_code: true } },
        },
      },
    },
  });
  if (!existing) {
    return 0;
  }

  const previous = new Map<string, IPreviousLine>(
    existing.items.map((li) => [
      li.id,
      {
        itemId: li.item_id,
        description: li.description,
        unit: li.unit,
        referenceCode: li.item.reference_code,
        unitTaxValue: li.unit_tax_value,
      },
    ]),
  );

  const city = normalizeName(data.city) ?? null;
  const state = normalizeName(data.state) ?? null;
  // Local alterado: o IBGE antigo (do cMun do XML) apontaria para a cidade
  // anterior no recorte regional do índice público.
  const locationChanged = city !== existing.city || state !== existing.state;
  const ibgeCode = locationChanged ? ibgeFor(state, city) : existing.ibge_code;

  const itemType = modelToItemType(data.model);
  // Itens resolvidos antes; a transação fica só com as 3 escritas rápidas.
  const rows = await resolveLineItems(itemType, data.items, previous);
  await prisma.$transaction([
    prisma.invoice.update({
      where: { id },
      data: {
        model: data.model,
        number: normalizeName(data.number) ?? data.number,
        series: normalizeName(data.series) ?? null,
        issued_at: data.issuedAt,
        neighborhood: normalizeName(data.neighborhood) ?? null,
        city,
        state,
        ibge_code: ibgeCode,
      },
    }),
    prisma.invoiceItem.deleteMany({ where: { invoice_id: id } }),
    prisma.invoiceItem.createMany({ data: rows.map((r) => ({ ...r, invoice_id: id })) }),
  ]);
  return 1;
}

/** Cria uma nota manualmente (entrada manual / conta de energia). */
export async function createInvoiceManual(
  userId: string,
  data: IInvoiceWriteInput & { companyId: string; accessKey: string },
): Promise<string> {
  // Chave que o usuário já usou numa nota excluída: libera antes de recriar.
  const previousKey = await prisma.invoice.findUnique({
    where: { user_id_access_key: { user_id: userId, access_key: data.accessKey } },
    select: { id: true, deleted_at: true },
  });
  if (previousKey?.deleted_at) {
    await purgeDeletedInvoice(previousKey.id);
  }

  const itemType = modelToItemType(data.model);
  // Itens resolvidos antes (o BusinessError de item ignorado dispara sem criar
  // nada); nota + itens num único create aninhado, atômico por si só.
  const rows = await resolveLineItems(itemType, data.items);
  const invoice = await prisma.invoice.create({
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
      ibge_code: ibgeFor(data.state, data.city),
      items: { createMany: { data: rows } },
    },
  });
  return invoice.id;
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
          category: { select: { name: true, icon: true, color: true } },
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
    categoryIcon: li.item.category?.icon,
    categoryColor: li.item.category?.color,
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
  if (!agg._min.issued_at || !agg._max.issued_at) {
    return null;
  }
  return { from: agg._min.issued_at, to: agg._max.issued_at };
}
