import 'server-only';
import { eanCandidates } from '~/lib/ean';
import { BusinessError } from '~/lib/errors';
import { findMunicipioByIbge, findMunicipioByName } from '~/lib/geo/municipios';
import { newId } from '~/lib/id';
import { normalizeName } from '~/lib/normalize';
import prisma from '~/lib/prisma';
import { normalizeUnit } from '~/lib/units';
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
