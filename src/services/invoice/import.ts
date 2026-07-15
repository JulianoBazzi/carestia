import { newId } from '~/lib/id';
import { normalizeName } from '~/lib/normalize';
import prisma from '~/lib/prisma';
import { normalizeUnit } from '~/lib/units';
import { fetchCnpj } from '~/services/brasilapi';
import { findOrCreateItem } from '~/services/invoice/item-matching';
import { type ICompanyDTO, type IParsedInvoice, parseXml } from '~/services/invoice/parser';

export type ImportResult =
  | { status: 'imported'; invoiceId: string; accessKey: string; ignoredItems?: number }
  | { status: 'duplicated'; accessKey: string }
  | { status: 'error'; message: string };

const P2002 = 'P2002'; // unique constraint violation

/** Mescla dados da empresa do XML com a BrasilAPI (preenche lacunas). */
async function resolveCompany(dto: ICompanyDTO) {
  // Privacy-first: só bairro/cidade/UF (índice regional) — sem rua/número/CEP.
  const hasLocation = Boolean(dto.city && dto.state);
  let source = 'xml';
  let data = { ...dto };

  if (!hasLocation) {
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

  const { data: companyData, origin } = await resolveCompany(parsed.company);

  // Empresa e itens são catálogo GLOBAL e ficam fora de transação de propósito:
  // a resolução de itens faz várias queries por linha (EAN, similaridade, alias)
  // e num banco remoto estourava o timeout da transação interativa (5s). Se a
  // criação da nota falhar depois (ex.: duplicada), empresa/itens persistidos
  // são entradas legítimas que o matching reutiliza — nada a desfazer.
  try {
    const company = await prisma.company.upsert({
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
      update: {
        social_name: companyData.socialName,
        fantasy_name: companyData.fantasyName,
      },
    });

    const lineItems = [];
    let ignoredItems = 0;
    for (const it of parsed.items) {
      // Reaproveita item existente parecido (pg_trgm) em vez de duplicar por variação de nome.
      const itemId = await findOrCreateItem(prisma, {
        type: it.type,
        reference_code: it.referenceCode,
        name: it.name,
        unit: it.unit,
        ean: it.ean,
        nbs_code: it.nbsCode,
        unitValue: Number(it.unitValue),
      });
      // Item ignorado pela administração: a linha é descartada (a nota ainda é
      // criada, preservando o dedup por access_key).
      if (itemId === null) {
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

    // Nota + itens num único create aninhado: atômico por si só, sem
    // transação interativa segurando conexão durante o trabalho acima.
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
        ibge_code: location.ibgeCode ?? null,
        items: { create: lineItems },
      },
    });

    return {
      status: 'imported',
      invoiceId: created.id,
      accessKey: parsed.invoice.accessKey,
      // Só informa quando houve linha bloqueada (mantém o payload enxuto).
      ...(ignoredItems > 0 && { ignoredItems }),
    };
  } catch (e) {
    if (
      typeof e === 'object' &&
      e !== null &&
      'code' in e &&
      (e as { code: string }).code === P2002
    ) {
      return { status: 'duplicated', accessKey: parsed.invoice.accessKey };
    }
    return { status: 'error', message: (e as Error).message };
  }
}
