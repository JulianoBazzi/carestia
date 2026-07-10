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
 * novo. Retorna o `id` do item.
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
): Promise<string> {
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
  }

  // Top-N por similaridade (não só o 1º): o melhor por nome pode falhar no
  // portão de preço enquanto um segundo candidato passa nos dois.
  const rows = await tx.$queryRaw<
    { id: string; sim: number; median_price: number | null; ean: string | null }[]
  >`
    SELECT i.id,
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

  const best = rows.find(
    (r) =>
      Number(r.sim) >= PRODUCT_SIMILARITY_THRESHOLD &&
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

  // Sem candidato parecido: cria. O upsert na unique exata (type+code+name)
  // protege contra corrida de duas importações com nome idêntico.
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
