import { mapPool } from '~/lib/concurrency';
import { BusinessError, isUniqueViolation } from '~/lib/errors';
import { findMunicipioByName } from '~/lib/geo/municipios';
import { newId } from '~/lib/id';
import { normalizeName } from '~/lib/normalize';
import prisma from '~/lib/prisma';
import { cacheGetJson, cacheSetJson } from '~/lib/redis';
import { normalizeUnit } from '~/lib/units';
import { fetchCnpj } from '~/services/brasilapi';
import { findOrCreateItem } from '~/services/invoice/item-matching';
import {
  type ICompanyDTO,
  type IItemDTO,
  type IParsedInvoice,
  parseXml,
} from '~/services/invoice/parser';
import { purgeDeletedInvoice } from '~/services/invoice/queries';

export type ImportResult =
  | {
      status: 'imported';
      invoiceId: string;
      accessKey: string;
      /** Linhas de itens bloqueados pela administração. */
      ignoredItems?: number;
      /** Linhas sem preço unitário válido (zero, negativo ou ausente). */
      invalidItems?: number;
    }
  | { status: 'duplicated'; accessKey: string }
  | { status: 'error'; message: string };

// Linhas da nota resolvidas em paralelo (limitado): equilíbrio entre acelerar
// a importação e não esgotar o pool de conexões (~3 requests × 5 ≈ 15 ≤ 20).
const ITEM_MATCH_CONCURRENCY = 5;

// Cache da empresa por documento: pula o findUnique no ramo sem localização.
// Invalidado em updateCompany/deleteCompany (management.ts). TTL curto porque
// empresa muda raramente e o pior caso é reusar localização levemente antiga.
const COMPANY_CACHE_TTL = 24 * 60 * 60; // 24h
const companyCacheKey = (document: string) => `company:${document}`;

interface ICachedCompany {
  social_name: string;
  fantasy_name: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  ibge_code: string | null;
}

/** Mescla dados da empresa do XML com o banco/BrasilAPI (preenche lacunas). */
async function resolveCompany(dto: ICompanyDTO) {
  // Privacy-first: só bairro/cidade/UF (índice regional) — sem rua/número/CEP.
  const hasLocation = Boolean(dto.city && dto.state);
  let source = 'xml';
  let data = { ...dto };

  if (!hasLocation) {
    // Empresa já conhecida com localização dispensa a BrasilAPI (que custava
    // até 8s por nota em lotes cujo XML não traz endereço do emitente). O cache
    // Redis evita até o findUnique em reimportações do mesmo emitente.
    const known =
      (await cacheGetJson<ICachedCompany>(companyCacheKey(dto.document))) ??
      (await prisma.company.findUnique({
        where: { document: dto.document },
        select: {
          social_name: true,
          fantasy_name: true,
          neighborhood: true,
          city: true,
          state: true,
          ibge_code: true,
        },
      }));
    if (known?.city && known.state) {
      data = {
        ...data,
        socialName: data.socialName || known.social_name,
        fantasyName: data.fantasyName || known.fantasy_name || undefined,
        neighborhood: data.neighborhood || known.neighborhood || undefined,
        city: data.city || known.city,
        state: data.state || known.state,
        ibgeCode: data.ibgeCode || known.ibge_code || undefined,
      };
    } else {
      const api = await fetchCnpj(dto.document);
      if (api) {
        source = dto.city ? 'xml' : 'brasilapi';
        data = {
          ...data,
          socialName: data.socialName || api.razao_social,
          fantasyName: data.fantasyName || api.nome_fantasia || undefined,
          neighborhood: data.neighborhood || api.bairro || undefined,
          city: data.city || api.municipio || undefined,
          state: data.state || api.uf || undefined,
        };
      }
    }
  }

  const normalized: ICompanyDTO = {
    ...data,
    socialName: normalizeName(data.socialName) ?? data.socialName,
    fantasyName: normalizeName(data.fantasyName),
    neighborhood: normalizeName(data.neighborhood),
    city: normalizeName(data.city),
    state: normalizeName(data.state),
  };

  return { data: normalized, origin: source };
}

/** Importa uma nota a partir do XML (NF-e, NFC-e, NF3e). */
export async function importInvoice(
  userId: string,
  xml: string,
  seenKeys?: Set<string>,
): Promise<ImportResult> {
  let parsed: IParsedInvoice;
  try {
    parsed = parseXml(xml);
  } catch (e) {
    return { status: 'error', message: (e as Error).message };
  }
  return importParsedInvoice(userId, parsed, seenKeys);
}

/**
 * Persiste uma nota JÁ estruturada. Ponto de entrada comum a todas as origens:
 * o XML chega por `importInvoice` e a NFC-e da Infosimples (que não tem XML)
 * chega direto daqui, pelo adaptador em `infosimples-nfce.ts`.
 */
export async function importParsedInvoice(
  userId: string,
  parsed: IParsedInvoice,
  seenKeys?: Set<string>,
): Promise<ImportResult> {
  // Beta: por ora importamos apenas produtos (NF-e, NFC-e, NF3e/energia).
  // NFS-e (serviços) fica para uma versão futura.
  if (parsed.invoice.model === 'nfse') {
    return {
      status: 'error',
      message: 'A importação de NFS-e (nota de serviço) será incluída em uma versão futura.',
    };
  }

  // Dedupe dentro do mesmo lote (sem hit no banco).
  if (seenKeys) {
    if (seenKeys.has(parsed.invoice.accessKey)) {
      return { status: 'duplicated', accessKey: parsed.invoice.accessKey };
    }
    seenKeys.add(parsed.invoice.accessKey);
  }

  // Preço unitário zero/negativo/ausente não é compra comparável (brinde,
  // desconto integral, falha do emitente): puxaria médias públicas e o índice
  // pessoal para baixo. A linha é descartada; a nota segue com as demais.
  const validItems = parsed.items.filter((it) => {
    const v = Number(it.unitValue);
    return Number.isFinite(v) && v > 0;
  });
  const invalidItems = parsed.items.length - validItems.length;

  // Empresa e itens são catálogo GLOBAL e ficam fora de transação de propósito:
  // a resolução de itens faz várias queries por linha (EAN, similaridade, alias)
  // e num banco remoto estourava o timeout da transação interativa (5s). Se a
  // criação da nota falhar depois (ex.: duplicada), empresa/itens persistidos
  // são entradas legítimas que o matching reutiliza — nada a desfazer.
  try {
    // Chave já importada por este usuário: ativa é duplicada (sem gastar a
    // resolução de empresa/itens); soft-deletada é apagada de vez para que a
    // reimportação funcione — a unique (user_id, access_key) inclui as
    // excluídas e o P2002 lá embaixo a trataria como duplicada para sempre.
    const previous = await prisma.invoice.findUnique({
      where: { user_id_access_key: { user_id: userId, access_key: parsed.invoice.accessKey } },
      select: { id: true, deleted_at: true },
    });
    if (previous && !previous.deleted_at) {
      return { status: 'duplicated', accessKey: parsed.invoice.accessKey };
    }
    if (previous) {
      await purgeDeletedInvoice(previous.id);
    }

    const { data: companyData, origin } = await resolveCompany(parsed.company);

    let company = await prisma.company.upsert({
      where: { document: companyData.document },
      create: {
        id: newId(),
        document: companyData.document,
        social_name: companyData.socialName,
        fantasy_name: companyData.fantasyName,
        neighborhood: companyData.neighborhood,
        city: companyData.city,
        state: companyData.state,
        ibge_code: companyData.ibgeCode,
        origin,
      },
      // Catálogo global: uma nota (possivelmente forjada) NUNCA sobrescreve o
      // que já está gravado — só completa campos vazios, logo abaixo.
      update: {},
    });

    // Completa o que está vazio (empresa criada por um XML sem endereço ficava
    // sem cidade/UF para sempre e cada nota nova do mesmo emitente voltava a
    // consultar a BrasilAPI) e restaura empresa soft-deletada — senão a nota
    // ficaria presa a um cadastro oculto que o admin não consegue editar.
    const fill = {
      ...(company.deleted_at && { deleted_at: null }),
      ...(!company.fantasy_name &&
        companyData.fantasyName && {
          fantasy_name: companyData.fantasyName,
        }),
      ...(!company.neighborhood &&
        companyData.neighborhood && {
          neighborhood: companyData.neighborhood,
        }),
      ...(!company.city && companyData.city && { city: companyData.city }),
      ...(!company.state && companyData.state && { state: companyData.state }),
      ...(!company.ibge_code && companyData.ibgeCode && { ibge_code: companyData.ibgeCode }),
    };
    if (Object.keys(fill).length > 0) {
      company = await prisma.company.update({ where: { id: company.id }, data: fill });
    }

    // Write-through: próximas notas do mesmo emitente resolvem a localização
    // pelo cache, sem findUnique nem BrasilAPI.
    await cacheSetJson(
      companyCacheKey(company.document),
      {
        social_name: company.social_name,
        fantasy_name: company.fantasy_name,
        neighborhood: company.neighborhood,
        city: company.city,
        state: company.state,
        ibge_code: company.ibge_code,
      } satisfies ICachedCompany,
      COMPANY_CACHE_TTL,
    );

    // Identidades repetidas na mesma nota (mesmo produto em mais de uma linha)
    // resolvem uma vez só e as demais linhas reusam o resultado. A resolução
    // roda em paralelo (pool limitado): cada linha faz várias queries e, em
    // série, a latência do banco remoto dominava o tempo de importação.
    // Reaproveita item existente parecido (pg_trgm) em vez de duplicar por
    // variação de nome.
    const identityOf = (it: IItemDTO) =>
      // Separador que não ocorre nos dados — espaço colidiria com nomes compostos.
      [it.type, it.referenceCode, it.name, it.unit ?? '', it.ean ?? ''].join('\u0000');
    const uniqueLines = new Map<string, IItemDTO>();
    for (const it of validItems) {
      if (!uniqueLines.has(identityOf(it))) {
        uniqueLines.set(identityOf(it), it);
      }
    }
    const lines = [...uniqueLines.values()];
    const resolvedIds = await mapPool(lines, ITEM_MATCH_CONCURRENCY, (it) =>
      findOrCreateItem(prisma, {
        type: it.type,
        reference_code: it.referenceCode,
        name: it.name,
        unit: it.unit,
        ean: it.ean,
        nbs_code: it.nbsCode,
        unitValue: Number(it.unitValue),
      }),
    );
    const itemIdByIdentity = new Map<string, string | null>();
    lines.forEach((it, i) => {
      itemIdByIdentity.set(identityOf(it), resolvedIds[i]);
    });

    const lineItems = [];
    let ignoredItems = 0;
    for (const it of validItems) {
      const itemId = itemIdByIdentity.get(identityOf(it));
      // Item ignorado pela administração: a linha é descartada (a nota ainda é
      // criada, preservando o dedup por access_key).
      if (itemId == null) {
        ignoredItems += 1;
        continue;
      }
      lineItems.push({
        id: newId(),
        item_id: itemId,
        description: normalizeName(it.description) ?? it.description,
        unit: normalizeUnit(it.unit),
        // Privacy-first: só o preço unitário (R$), sem quantidade nem total.
        unit_value: Number(it.unitValue),
        // Tributo aproximado por unidade (R$/un); null quando a nota não informa
        // o <vTotTrib> da linha — a tag é opcional no layout.
        unit_tax_value: it.unitTaxValue != null ? Number(it.unitTaxValue) : null,
      });
    }

    // Local da compra/consumo (anonimizado) para o índice regional.
    // Energia: o parser informa o local de consumo (acessante); demais: usa o emitente.
    const location = parsed.invoice.location ?? {
      neighborhood: companyData.neighborhood,
      city: companyData.city,
      state: companyData.state,
      ibgeCode: companyData.ibgeCode,
    };

    // Nota + itens num único create aninhado (createMany = 1 INSERT para todas
    // as linhas): atômico por si só, sem transação interativa segurando conexão
    // durante o trabalho acima.
    try {
      const created = await prisma.invoice.create({
        data: {
          id: newId(),
          user_id: userId,
          company_id: company.id,
          model: parsed.invoice.model,
          number: normalizeName(parsed.invoice.number) ?? parsed.invoice.number,
          series: normalizeName(parsed.invoice.series) ?? null,
          access_key: parsed.invoice.accessKey,
          issued_at: new Date(parsed.invoice.issuedAt),
          // Privacy-first: sem total da nota nem XML cru.
          neighborhood: normalizeName(location.neighborhood) ?? null,
          city: normalizeName(location.city) ?? null,
          state: normalizeName(location.state) ?? null,
          // Sem cMun no XML (NFC-e via Infosimples, BrasilAPI), resolve o IBGE pelo
          // nome da cidade + UF para o índice regional casar por código.
          ibge_code:
            location.ibgeCode ??
            findMunicipioByName(location.state, location.city)?.ibge_code ??
            null,
          items: { createMany: { data: lineItems } },
        },
      });

      return {
        status: 'imported',
        invoiceId: created.id,
        accessKey: parsed.invoice.accessKey,
        // Só informa quando houve linha bloqueada (mantém o payload enxuto).
        ...(ignoredItems > 0 && { ignoredItems }),
        ...(invalidItems > 0 && { invalidItems }),
      };
    } catch (e) {
      // Só o P2002 DESTE create é nota duplicada — a unique (user_id, access_key).
      // Uniques violadas na resolução de empresa/itens não podem virar
      // "duplicada" falsa; caem no catch externo como erro.
      if (isUniqueViolation(e)) {
        return { status: 'duplicated', accessKey: parsed.invoice.accessKey };
      }
      throw e;
    }
  } catch (e) {
    // Mensagem de negócio vai ao usuário; o resto (Prisma, rede) só no log —
    // não vaza nome de coluna nem detalhe de conexão.
    if (e instanceof BusinessError) {
      return { status: 'error', message: e.message };
    }
    console.error('[import] falha ao importar nota', e);
    return { status: 'error', message: 'Erro inesperado ao importar a nota. Tente novamente.' };
  }
}
