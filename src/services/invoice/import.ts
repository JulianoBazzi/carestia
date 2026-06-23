import { newId } from '~/lib/id';
import { toCents } from '~/lib/money';
import prisma from '~/lib/prisma';
import { fetchCnpj } from '~/services/brasilapi';
import { type ICompanyDTO, type IParsedInvoice, parseXml } from '~/services/invoice/parser';

export type ImportResult =
  | { status: 'imported'; invoiceId: string; accessKey: string }
  | { status: 'duplicated'; accessKey: string }
  | { status: 'error'; message: string };

const P2002 = 'P2002'; // unique constraint violation

/** Mescla dados da empresa do XML com a BrasilAPI (preenche lacunas). */
async function resolveCompany(dto: ICompanyDTO) {
  const hasAddress = Boolean(dto.street && dto.zipcode);
  let source = 'xml';
  let data = { ...dto };

  if (!hasAddress) {
    const api = await fetchCnpj(dto.document);
    if (api) {
      source = dto.street ? 'xml' : 'brasilapi';
      data = {
        ...data,
        socialName: data.socialName || api.razao_social,
        fantasyName: data.fantasyName || api.nome_fantasia || undefined,
        street: data.street || api.logradouro || undefined,
        number: data.number || api.numero || undefined,
        neighborhood: data.neighborhood || api.bairro || undefined,
        city: data.city || api.municipio || undefined,
        state: data.state || api.uf || undefined,
        zipcode: data.zipcode || api.cep || undefined,
      };
    }
  }

  return { data, source };
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

  // Dedupe dentro do mesmo lote (sem hit no banco).
  if (seenKeys) {
    if (seenKeys.has(parsed.invoice.accessKey)) {
      return { status: 'duplicated', accessKey: parsed.invoice.accessKey };
    }
    seenKeys.add(parsed.invoice.accessKey);
  }

  const { data: companyData, source } = await resolveCompany(parsed.company);

  try {
    const invoiceId = await prisma.$transaction(async (tx) => {
      const company = await tx.company.upsert({
        where: { document: companyData.document },
        create: {
          id: newId(),
          document: companyData.document,
          social_name: companyData.socialName,
          fantasy_name: companyData.fantasyName,
          street: companyData.street,
          number: companyData.number,
          neighborhood: companyData.neighborhood,
          city: companyData.city,
          state: companyData.state,
          zipcode: companyData.zipcode,
          ibge_code: companyData.ibgeCode,
          source,
        },
        update: {
          social_name: companyData.socialName,
          fantasy_name: companyData.fantasyName,
        },
      });

      const lineItems = [];
      for (const it of parsed.items) {
        const item = await tx.item.upsert({
          where: {
            type_reference_code_name: {
              type: it.type,
              reference_code: it.referenceCode,
              name: it.name,
            },
          },
          create: {
            id: newId(),
            type: it.type,
            reference_code: it.referenceCode,
            name: it.name,
            unit: it.unit,
            nbs_code: it.nbsCode,
          },
          update: {},
        });
        lineItems.push({
          id: newId(),
          item_id: item.id,
          description: it.description,
          quantity: it.quantity,
          unit: it.unit,
          unit_value: toCents(it.unitValue),
          total_value: toCents(it.totalValue),
        });
      }

      const invoice = await tx.invoice.create({
        data: {
          id: newId(),
          user_id: userId,
          company_id: company.id,
          model: parsed.invoice.model,
          number: parsed.invoice.number,
          series: parsed.invoice.series,
          access_key: parsed.invoice.accessKey,
          raw_xml: xml,
          issued_at: new Date(parsed.invoice.issuedAt),
          total_value: toCents(parsed.invoice.totalValue),
          items: { create: lineItems },
        },
      });

      return invoice.id;
    });

    return {
      status: 'imported',
      invoiceId,
      accessKey: parsed.invoice.accessKey,
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
