import 'server-only';
import { mapPool } from '~/lib/concurrency';
import { eanCandidates } from '~/lib/ean';
import { BusinessError } from '~/lib/errors';
import { findMunicipioByIbge, findMunicipioByName } from '~/lib/geo/municipios';
import { newId } from '~/lib/id';
import { normalizeName } from '~/lib/normalize';
import prisma from '~/lib/prisma';
import { normalizeUnit } from '~/lib/units';
import type { FlyerObservationsInput } from '~/schemas/flyer';
import type { PriceObservationInput } from '~/schemas/price-observation';
import { findOrCreateItem } from '~/services/invoice/item-matching';

/**
 * Observações de preço de gôndola (etiqueta lida no scanner): segunda fonte do
 * índice público, ao lado das notas. Privacy-first — guarda só preço unitário +
 * cidade/UF; a foto não chega a ser persistida. `user_id` fica na linha para
 * controle de abuso/moderação e nunca é lido pela agregação pública.
 */

/** Janela em que o mesmo usuário repetir item+preço conta como reenvio. */
const IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000;

/**
 * IBGE resolvido no servidor: pelo nome + UF informados; o código enviado pelo
 * client (vindo da geolocalização) só vale se for um município daquela UF — senão
 * uma observação poderia cair nas médias de outra cidade.
 */
function resolveIbge(state: string, city: string, clientCode?: string): string | null {
  const byName = findMunicipioByName(state, city);
  if (byName) {
    return byName.ibge_code;
  }
  const byCode = clientCode ? findMunicipioByIbge(clientCode) : undefined;
  return byCode && byCode.uf === state ? byCode.ibge_code : null;
}

export async function createPriceObservation(
  userId: string,
  input: PriceObservationInput,
): Promise<{ id: string; itemId: string }> {
  // Mesma precisão da coluna (Decimal 14,4): a checagem de reenvio compara com o
  // valor já arredondado pelo banco.
  const unitValue = Math.round(input.unit_value * 10_000) / 10_000;

  // O catálogo pode guardar o MESMO produto com outra forma do código (UPC-A de
  // 12 dígitos vs EAN-13 com zero à esquerda). O atalho por EAN de
  // `findOrCreateItem` compara por igualdade, então resolvemos antes o item
  // existente e passamos adiante o EAN como está gravado.
  const existing = await prisma.item.findFirst({
    where: { type: 'product', ean: { in: eanCandidates(input.ean) }, deleted_at: null },
    select: { name: true, ean: true, unit: true },
  });

  const name = normalizeName(input.name) ?? existing?.name;
  if (!name) {
    throw new BusinessError('Produto ainda não catalogado: informe o nome.', 422);
  }

  // Fora de transação de propósito: `findOrCreateItem` exige o client raiz.
  const itemId = await findOrCreateItem(prisma, {
    type: 'product',
    // Etiqueta não traz NCM — mesmo bucket dos itens de NFC-e.
    reference_code: '',
    name: existing?.name ?? name,
    unit: input.unit ?? existing?.unit,
    ean: existing?.ean ?? input.ean,
    unitValue,
  });
  if (!itemId) {
    throw new BusinessError('Este produto está bloqueado no catálogo.', 422);
  }

  // Reenvio (duplo toque, retry de rede): devolve a observação já gravada.
  const duplicate = await prisma.priceObservation.findFirst({
    where: {
      user_id: userId,
      item_id: itemId,
      unit_value: unitValue,
      deleted_at: null,
      created_at: { gte: new Date(Date.now() - IDEMPOTENCY_WINDOW_MS) },
    },
    select: { id: true },
  });
  if (duplicate) {
    return { id: duplicate.id, itemId };
  }

  const created = await prisma.priceObservation.create({
    data: {
      id: newId(),
      user_id: userId,
      item_id: itemId,
      unit_value: unitValue,
      unit: normalizeUnit(input.unit),
      source: 'label_photo',
      observed_at: new Date(),
      city: normalizeName(input.city) ?? null,
      state: input.state,
      ibge_code: resolveIbge(input.state, input.city, input.ibge_code),
    },
    select: { id: true },
  });
  return { id: created.id, itemId };
}

/** Região de uma observação de encarte: cidade (com IBGE) ou a UF inteira. */
export interface IFlyerRegion {
  city: string | null;
  ibge_code: string | null;
}

/**
 * Cidades do encarte → regiões gravadas: nomes normalizados e sem repetição,
 * IBGE resolvido pelo nome + UF. Sem cidade, uma única região só com a UF.
 */
export function buildFlyerRegions(state: string, cities: string[]): IFlyerRegion[] {
  const seen = new Set<string>();
  const regions: IFlyerRegion[] = [];
  for (const raw of cities) {
    const city = normalizeName(raw);
    if (!city || seen.has(city)) {
      continue;
    }
    seen.add(city);
    regions.push({ city, ibge_code: findMunicipioByName(state, city)?.ibge_code ?? null });
  }
  return regions.length > 0 ? regions : [{ city: null, ibge_code: null }];
}

/** Chave de duplicidade de uma observação de encarte dentro do mesmo dia + UF. */
export function flyerDedupeKey(itemId: string, unitValue: number, city: string | null): string {
  return `${itemId}|${unitValue.toFixed(4)}|${city ?? ''}`;
}

const round4 = (v: number) => Math.round(v * 10_000) / 10_000;

export interface IFlyerSaveResult {
  created: number;
  /** Já gravados antes (mesmo item + preço + dia + região) ou repetidos no envio. */
  skipped: number;
  failed: { name: string; message: string }[];
}

/** Itens resolvidos em paralelo — `findOrCreateItem` é seguro no client raiz. */
const FLYER_RESOLVE_CONCURRENCY = 5;

/**
 * Grava os itens revisados de um encarte (só-admin) como observações
 * `source = 'flyer'`: uma por item × cidade (ou uma só para a UF). O preço é o
 * "por" e entra na média como qualquer observação; o "de" vai em
 * `regular_value`. A loja não é gravada.
 *
 * Idempotente por item + preço + dia + UF + cidade: o mesmo encarte reenviado,
 * ou prints que se sobrepõem, não contam duas vezes.
 */
export async function createFlyerObservations(
  userId: string,
  input: FlyerObservationsInput,
): Promise<IFlyerSaveResult> {
  const day = input.observed_at;
  // Dia sem hora vira meio-dia BRT (mesma regra da nota manual).
  const observedAt = new Date(`${day}T12:00:00-03:00`);
  const dayStart = new Date(`${day}T00:00:00-03:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const regions = buildFlyerRegions(input.state, input.cities);
  const failed: IFlyerSaveResult['failed'] = [];

  const resolved = await mapPool(input.items, FLYER_RESOLVE_CONCURRENCY, async (item) => {
    const unitValue = round4(item.unit_value);
    if (item.item_id) {
      const found = await prisma.item.findFirst({
        where: { id: item.item_id, type: 'product', deleted_at: null },
        select: { id: true, unit: true },
      });
      if (!found) {
        failed.push({ name: item.name, message: 'Item do catálogo não encontrado.' });
        return null;
      }
      return { item, itemId: found.id, unit: item.unit ?? found.unit, unitValue };
    }
    // Fora de transação de propósito: `findOrCreateItem` exige o client raiz.
    const itemId = await findOrCreateItem(prisma, {
      type: 'product',
      // Encarte não traz NCM — mesmo bucket dos itens de NFC-e e etiqueta.
      reference_code: '',
      name: item.name,
      unit: item.unit,
      unitValue,
    });
    if (!itemId) {
      failed.push({ name: item.name, message: 'Produto bloqueado no catálogo.' });
      return null;
    }
    return { item, itemId, unit: item.unit ?? null, unitValue };
  });
  const lines = resolved.filter((r) => r !== null);

  // Uma ida ao banco para tudo o que já foi gravado deste encarte.
  const existing =
    lines.length > 0
      ? await prisma.priceObservation.findMany({
          where: {
            source: 'flyer',
            deleted_at: null,
            state: input.state,
            item_id: { in: Array.from(new Set(lines.map((l) => l.itemId))) },
            observed_at: { gte: dayStart, lt: dayEnd },
          },
          select: { item_id: true, unit_value: true, city: true },
        })
      : [];
  const seen = new Set(
    existing.map((e) => flyerDedupeKey(e.item_id, Number(e.unit_value), e.city)),
  );

  let skipped = 0;
  const data = [];
  for (const line of lines) {
    for (const region of regions) {
      const key = flyerDedupeKey(line.itemId, line.unitValue, region.city);
      if (seen.has(key)) {
        skipped += 1;
        continue;
      }
      seen.add(key);
      data.push({
        id: newId(),
        user_id: userId,
        item_id: line.itemId,
        unit_value: line.unitValue,
        // "de" menor ou igual ao "por" não é preço riscado — descarta.
        regular_value:
          line.item.regular_value !== undefined && line.item.regular_value > line.unitValue
            ? round4(line.item.regular_value)
            : null,
        unit: normalizeUnit(line.unit),
        source: 'flyer',
        observed_at: observedAt,
        city: region.city,
        state: input.state,
        ibge_code: region.ibge_code,
      });
    }
  }

  if (data.length > 0) {
    await prisma.priceObservation.createMany({ data });
  }
  return { created: data.length, skipped, failed };
}
