import 'server-only';
import type { Prisma } from '~/generated/prisma/client';
import { newId } from '~/lib/id';
import { matchKey, normalizeName } from '~/lib/normalize';
import { normalizeUnit } from '~/lib/units';
import { validEan } from '~/services/invoice/parser';

/**
 * Limiar de similaridade (0–1, `word_similarity` do pg_trgm) para considerar que
 * dois nomes descrevem o MESMO produto dentro do mesmo tipo+código (NCM).
 *
 * Conservador de propósito: juntar demais é irreversível (não há "separar", só
 * mesclar). O que ficar de fora é resolvido na mesclagem manual da tela de Itens.
 * A comparação usa `matchKey` (sem pontuação), então variações de escrita
 * ("S-10", "S 10", "S10") já colapsam antes deste limiar. Calibrar contra dados reais.
 */
export const PRODUCT_SIMILARITY_THRESHOLD = 0.6;

/**
 * Fator máximo de diferença de preço para aceitar que dois itens são o MESMO
 * produto. Segundo portão do matching: mesmo com nome parecido, não juntamos um
 * item cujo preço unitário difere mais de 5× da mediana do candidato (evita
 * casar um produto de R$1000 com um de R$10 sob o mesmo NCM). Tolerante de
 * propósito — a inflação é o objetivo do app, preços variam no tempo/região.
 */
export const PRICE_MATCH_MAX_RATIO = 5;

// Unidades de embalagem que podem aparecer embutidas no nome do produto.
const PACK_SIZE_RE = /(\d+(?:[.,]\d+)?)\s?(KG|G|MG|L|ML|KWH|UN|CX|PCT|PC|DZ)\b/g;

/**
 * Extrai o(s) tamanho(s) de embalagem embutido(s) no nome ("ARROZ 5KG" → "5KG",
 * "REFRI 2L" → "2L") num formato canônico, ou `null` se não houver. Dois produtos
 * de mesma unidade mas tamanhos diferentes NÃO devem ser mesclados
 * automaticamente — o preço unitário é legitimamente diferente.
 */
export function packSize(name: string | null | undefined): string | null {
  if (!name) return null;
  const upper = name.toUpperCase();
  const found: string[] = [];
  for (const m of upper.matchAll(PACK_SIZE_RE)) {
    const qty = Number(m[1].replace(',', '.'));
    if (!Number.isFinite(qty)) continue;
    found.push(`${qty}${m[2]}`);
  }
  if (found.length === 0) return null;
  return found.sort().join('+');
}

export interface IItemMatchInput {
  type: 'product' | 'service' | 'energy';
  reference_code: string;
  name: string;
  unit?: string | null;
  nbs_code?: string | null;
  /** GTIN/EAN comercial (cEAN); casamento exato quando presente e válido. */
  ean?: string | null;
  /** Preço unitário (R$) da linha sendo importada; usado no portão de preço. */
  unitValue?: number | null;
}

/**
 * Aceita o casamento por preço quando não há histórico (mediana nula) ou quando
 * o preço está dentro de [1/factor, factor] da mediana do candidato.
 */
export function priceWithinBand(
  value: number | null | undefined,
  median: number | null | undefined,
  factor: number,
): boolean {
  if (value == null || value <= 0 || median == null || median <= 0) return true;
  const ratio = value / median;
  return ratio >= 1 / factor && ratio <= factor;
}

/**
 * Encontra um `Item` global equivalente (mesmo tipo+código+unidade, nome parecido
 * e preço compatível) e o reaproveita; se nenhum passar nos dois portões, cria um
 * novo. Retorna o `id` do item, ou `null` quando a linha casa com um item
 * IGNORADO (`ignored_at`) — o chamador deve descartar a linha, nunca recriar.
 *
 * A extensão `pg_trgm` (habilitada no schema) faz o casamento por similaridade,
 * absorvendo variações de descrição do mesmo produto entre emitentes
 * (ex.: "DIESEL S 10", "OLEO DIESEL S10", "DIESEL B S-10 COMUM"). O portão de
 * preço (`priceWithinBand`) evita colar produtos distintos que apenas compartilham
 * NCM/nome parecido.
 */
export async function findOrCreateItem(
  tx: Prisma.TransactionClient,
  input: IItemMatchInput,
): Promise<string | null> {
  const name = normalizeName(input.name) ?? input.name;
  const key = matchKey(input.name);
  // Normaliza código e unidade (UPPERCASE + sem acento) no único choke point,
  // para que WHERE e create usem os mesmos valores e o matching por
  // unidade/NCM fique consistente ('kWh' vs 'KWH', 'l' vs 'L').
  const referenceCode = normalizeName(input.reference_code) ?? input.reference_code;
  const unit = normalizeUnit(input.unit);
  const ean = validEan(input.ean);

  // Atalho determinístico: mesmo código de barras = mesmo produto. Confiamos no
  // EAN e reaproveitamos o item direto, sem passar por nome/preço.
  if (ean) {
    const hit = await tx.item.findFirst({
      where: { type: input.type, ean, deleted_at: null },
      select: { id: true },
    });
    if (hit) {
      return hit.id;
    }
    // Mesmo GTIN de um item IGNORADO: a linha é bloqueada — recriar sob outro
    // nome burlaria o bloqueio permanente. Itens apenas soft-deletados (ex.:
    // mesclados) não entram aqui e seguem o fluxo normal.
    const ignored = await tx.item.findFirst({
      where: { type: input.type, ean, ignored_at: { not: null } },
      select: { id: true },
    });
    if (ignored) {
      return null;
    }
  }

  // Top-N por similaridade (não só o 1º): o melhor por nome pode falhar no
  // portão de preço enquanto um segundo candidato passa nos dois.
  const rows = await tx.$queryRaw<
    { id: string; name: string; sim: number; median_price: number | null; ean: string | null }[]
  >`
    SELECT i.id,
           i.name,
           i.ean,
           word_similarity(${key}::text, regexp_replace(i.name, '[^A-Za-z0-9 ]', '', 'g')) AS sim,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY ii.unit_value) AS median_price
    FROM items i
    LEFT JOIN invoice_items ii ON ii.item_id = i.id
    WHERE i.type = ${input.type}::item_type
      AND i.reference_code = ${referenceCode}
      AND i.deleted_at IS NULL
      AND i.unit IS NOT DISTINCT FROM ${unit}::varchar
    GROUP BY i.id, i.name
    ORDER BY sim DESC
    LIMIT 5
  `;

  // Terceiro portão: tamanho de embalagem embutido no nome (ex.: "5KG", "500ML").
  // Mesma unidade + nome parecido não basta — "ARROZ 1KG" e "ARROZ 5KG" têm o
  // preço unitário legitimamente diferente e NÃO são o mesmo produto.
  const inputPack = packSize(input.name);
  const best = rows.find(
    (r) =>
      Number(r.sim) >= PRODUCT_SIMILARITY_THRESHOLD &&
      packSize(r.name) === inputPack &&
      priceWithinBand(
        input.unitValue,
        r.median_price == null ? null : Number(r.median_price),
        PRICE_MATCH_MAX_RATIO,
      ),
  );
  if (best) {
    // Backfill: item casado por nome ainda sem EAN herda o GTIN desta importação,
    // acelerando (e ancorando) casamentos futuros do mesmo produto.
    if (ean && best.ean == null) {
      await tx.item.update({ where: { id: best.id }, data: { ean } });
    }
    return best.id;
  }

  // Sem candidato parecido: olha a unique exata (type+code+name) ANTES de criar,
  // enxergando também linhas soft-deletadas (a unique não filtra `deleted_at`):
  // - IGNORADO (`ignored_at`): bloqueio permanente — a linha é descartada e o
  //   item NUNCA é reativado.
  // - Soft-deletado comum (ex.: mesclado): o produto voltou a ser comprado →
  //   RESTAURA (`deleted_at: null`); sem isso os novos invoice_items ficariam
  //   presos a um item "zumbi" (fora de `listItems`, mas contando em agregações).
  // Obs.: o bloqueio é determinístico (unique exata ou EAN); um item ignorado
  // ainda pode ressurgir como item NOVO se vier com nome diferente e sem/outro EAN.
  const existing = await tx.item.findUnique({
    where: {
      type_reference_code_name: {
        type: input.type,
        reference_code: referenceCode,
        name,
      },
    },
    select: { id: true, deleted_at: true, ignored_at: true },
  });
  if (existing) {
    if (existing.ignored_at) {
      return null;
    }
    if (existing.deleted_at) {
      await tx.item.update({ where: { id: existing.id }, data: { deleted_at: null } });
    }
    return existing.id;
  }

  // Cria. O upsert com `update: {}` vazio só absorve a corrida de duas
  // importações criando o mesmo item ao mesmo tempo (a linha concorrente é
  // recém-criada e ativa → no-op correto, sem risco de des-esconder um item
  // ignorado no meio do voo).
  const item = await tx.item.upsert({
    where: {
      type_reference_code_name: {
        type: input.type,
        reference_code: referenceCode,
        name,
      },
    },
    create: {
      id: newId(),
      type: input.type,
      reference_code: referenceCode,
      name,
      unit,
      ean: ean ?? null,
      nbs_code: input.nbs_code ?? null,
    },
    update: {},
  });
  return item.id;
}
