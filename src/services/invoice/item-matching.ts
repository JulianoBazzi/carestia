import 'server-only';
import type { Prisma } from '~/generated/prisma/client';
import { eanCandidates } from '~/lib/ean';
import { isUniqueViolation } from '~/lib/errors';
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
 * Limiar para itens SEM código de referência (`reference_code = ''`) — caso da
 * NFC-e consultada na Infosimples, que não expõe NCM.
 *
 * Mais rígido que o normal porque o 0.6 acima só é seguro por causa do NCM: ele
 * restringe os candidatos a produtos da mesma classe fiscal ANTES da comparação
 * por nome. No bucket vazio esse filtro não existe e todos os produtos sem
 * código concorrem entre si, então nomes parecidos de produtos DIFERENTES
 * ("ERVA TERERE UHDE MENTA" vs "ERVA TERERE UHDE LIMAO" — mesma unidade, mesmo
 * pack, preço quase igual) passariam. Errar duplicando é reversível pela
 * mesclagem manual; mesclar errado não é.
 */
export const NO_REFERENCE_SIMILARITY_THRESHOLD = 0.85;

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
  if (!name) {
    return null;
  }
  const upper = name.toUpperCase();
  const found: string[] = [];
  for (const m of upper.matchAll(PACK_SIZE_RE)) {
    const qty = Number(m[1].replace(',', '.'));
    if (!Number.isFinite(qty)) {
      continue;
    }
    found.push(`${qty}${m[2]}`);
  }
  if (found.length === 0) {
    return null;
  }
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
  if (value == null || value <= 0 || median == null || median <= 0) {
    return true;
  }
  const ratio = value / median;
  return ratio >= 1 / factor && ratio <= factor;
}

/**
 * Resolve um nome alternativo (gravado pela mesclagem — ver `mergeItems`) para o
 * item principal. Retorna `null` quando NÃO há alias para a identidade (o fluxo
 * normal continua) ou `{ id }` quando há: `id` do item principal, ou `id: null`
 * se o principal está ignorado (a linha deve ser descartada). Principal apenas
 * soft-deletado é restaurado — mesma semântica do restore da unique exata.
 */
async function resolveAlias(
  tx: Prisma.TransactionClient,
  type: IItemMatchInput['type'],
  referenceCode: string,
  name: string,
): Promise<{ id: string | null } | null> {
  const alias = await tx.itemAlias.findUnique({
    where: { type_reference_code_name: { type, reference_code: referenceCode, name } },
    select: { item: { select: { id: true, deleted_at: true, ignored_at: true } } },
  });
  if (!alias) {
    return null;
  }
  if (alias.item.ignored_at) {
    return { id: null };
  }
  if (alias.item.deleted_at) {
    await tx.item.update({ where: { id: alias.item.id }, data: { deleted_at: null } });
  }
  return { id: alias.item.id };
}

/**
 * Aplica a semântica de adoção de um item achado pela unique exata: IGNORADO
 * bloqueia a linha (`null`), soft-deletado comum é restaurado (o produto voltou
 * a ser comprado), ativo é reaproveitado.
 */
async function adoptExisting(
  tx: Prisma.TransactionClient,
  item: { id: string; deleted_at: Date | null; ignored_at: Date | null },
): Promise<string | null> {
  if (item.ignored_at) {
    return null;
  }
  if (item.deleted_at) {
    await tx.item.update({ where: { id: item.id }, data: { deleted_at: null } });
  }
  return item.id;
}

/**
 * Encontra um `Item` global equivalente (mesmo tipo+código+unidade, nome parecido
 * e preço compatível) e o reaproveita; se nenhum passar nos dois portões, cria um
 * novo. Retorna o `id` do item, ou `null` quando a linha casa com um item
 * IGNORADO (`ignored_at`) — o chamador deve descartar a linha, nunca recriar.
 *
 * Seguro para rodar em paralelo (linhas da mesma nota) SOMENTE com o client
 * raiz (pool): as escritas são idempotentes e a corrida de criação é absorvida
 * no upsert final. Nunca paralelize com uma transação interativa (conexão única).
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

  // Atalho determinístico: mesmo código de barras = mesmo produto. Uma única
  // query traz todos os itens com esse GTIN (incluindo as variantes UPC-A ×
  // EAN-13 com zero à esquerda, que são o mesmo produto) e a precedência é
  // decidida em JS (menos round-trips — a importação roda fora de transação,
  // mas cada query ainda custa uma ida ao banco remoto).
  if (ean) {
    const found = await tx.item.findMany({
      where: { type: input.type, ean: { in: eanCandidates(ean) } },
      select: {
        id: true,
        reference_code: true,
        name: true,
        deleted_at: true,
        ignored_at: true,
        ean: true,
      },
    });
    // O código exatamente igual ao da nota vem primeiro.
    const hits = [...found].sort((a, b) => Number(b.ean === ean) - Number(a.ean === ean));
    // Ativo: reaproveita direto, sem passar por nome/preço.
    const active = hits.find((h) => !h.deleted_at);
    if (active) {
      return active.id;
    }
    // Mesmo GTIN de um item IGNORADO: a linha é bloqueada — recriar sob outro
    // nome burlaria o bloqueio permanente.
    if (hits.some((h) => h.ignored_at)) {
      return null;
    }
    // GTIN que só existe num item MESCLADO legado (merges antigos deixavam o
    // source soft-deletado; hoje o merge apaga a linha): segue pelo alias da
    // identidade dele até o item principal, em vez de criar um duplicado novo.
    const merged = hits.find((h) => h.deleted_at && !h.ignored_at);
    if (merged) {
      const aliased = await resolveAlias(tx, input.type, merged.reference_code, merged.name);
      if (aliased) {
        return aliased.id;
      }
    }
  }

  // Top-N por similaridade (não só o 1º): o melhor por nome pode falhar no
  // portão de preço enquanto um segundo candidato passa nos dois. Os nomes
  // alternativos (aliases de mesclagem) entram como candidatos do item
  // principal: uma variação nova pode parecer mais com o alias do que com o
  // nome atual do item. A mediana de preço (histórico em invoice_items) é
  // calculada só para os 5 finalistas — computá-la para todos os candidatos
  // do NCM encarecia cada linha conforme o banco cresce.
  const rows = await tx.$queryRaw<
    { id: string; name: string; sim: number; median_price: number | null; ean: string | null }[]
  >`
    WITH candidates AS (
      SELECT i.id, i.name, i.ean
      FROM items i
      WHERE i.type = ${input.type}::item_type
        AND i.reference_code = ${referenceCode}
        AND i.deleted_at IS NULL
        AND i.unit IS NOT DISTINCT FROM ${unit}::varchar
      UNION ALL
      SELECT i.id, a.name, i.ean
      FROM item_aliases a
      JOIN items i ON i.id = a.item_id
      WHERE a.type = ${input.type}::item_type
        AND a.reference_code = ${referenceCode}
        AND i.deleted_at IS NULL
        AND i.unit IS NOT DISTINCT FROM ${unit}::varchar
    ),
    finalists AS (
      SELECT DISTINCT c.id,
             c.name,
             c.ean,
             word_similarity(${key}::text, regexp_replace(c.name, '[^A-Za-z0-9 ]', '', 'g')) AS sim
      FROM candidates c
      ORDER BY sim DESC, id
      LIMIT 5
    )
    SELECT f.id,
           f.name,
           f.ean,
           f.sim,
           m.median_price
    FROM finalists f
    LEFT JOIN LATERAL (
      SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY ii.unit_value) AS median_price
      FROM invoice_items ii
      WHERE ii.item_id = f.id
    ) m ON TRUE
    ORDER BY f.sim DESC, f.id
  `;

  // Terceiro portão: tamanho de embalagem embutido no nome (ex.: "5KG", "500ML").
  // Mesma unidade + nome parecido não basta — "ARROZ 1KG" e "ARROZ 5KG" têm o
  // preço unitário legitimamente diferente e NÃO são o mesmo produto.
  const inputPack = packSize(input.name);
  // Sem NCM não há pré-filtro por classe fiscal — exige-se mais do nome.
  const threshold = referenceCode
    ? PRODUCT_SIMILARITY_THRESHOLD
    : NO_REFERENCE_SIMILARITY_THRESHOLD;
  const best = rows.find(
    (r) =>
      Number(r.sim) >= threshold &&
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

  // Nome alternativo exato (alias de mesclagem): a identidade do item mesclado
  // aponta para o principal (o merge apaga a linha do source; o alias é o único
  // registro da identidade). Roda ANTES da unique de items porque merges
  // legados deixaram o source soft-deletado ocupando a mesma chave — sem o
  // alias na frente, o restore abaixo ressuscitaria a duplicata mesclada.
  const aliased = await resolveAlias(tx, input.type, referenceCode, name);
  if (aliased) {
    return aliased.id;
  }

  // Sem candidato parecido nem alias: olha a unique exata (type+code+name) ANTES
  // de criar, enxergando também linhas soft-deletadas (a unique não filtra
  // `deleted_at`):
  // - IGNORADO (`ignored_at`): bloqueio permanente — a linha é descartada e o
  //   item NUNCA é reativado.
  // - Soft-deletado comum (dados legados/ocultos por outras vias): o produto
  //   voltou a ser comprado → RESTAURA (`deleted_at: null`); sem isso os novos
  //   invoice_items ficariam presos a um item "zumbi" (fora de `listItems`,
  //   mas contando em agregações). Itens mesclados não chegam aqui: o alias
  //   (mesma chave) intercepta antes — e merges novos nem deixam linha.
  // Obs.: o bloqueio é determinístico (unique exata, alias ou EAN); um item
  // ignorado ainda pode ressurgir como item NOVO se vier com nome diferente e
  // sem/outro EAN.
  const uniqueWhere = {
    type_reference_code_name: {
      type: input.type,
      reference_code: referenceCode,
      name,
    },
  };
  const existing = await tx.item.findUnique({
    where: uniqueWhere,
    select: { id: true, deleted_at: true, ignored_at: true },
  });
  if (existing) {
    return adoptExisting(tx, existing);
  }

  // Cria. O upsert com `update: {}` vazio absorve a corrida de duas resoluções
  // criando o mesmo item ao mesmo tempo (a linha concorrente é recém-criada e
  // ativa → no-op correto, sem risco de des-esconder um item ignorado no meio
  // do voo). Quando o Prisma emula o upsert (SELECT→INSERT), a corrida ainda
  // pode vazar como P2002 — nesse caso o item acabou de ser criado pelo voo
  // concorrente e a re-leitura pela unique resolve com a mesma semântica.
  try {
    const item = await tx.item.upsert({
      where: uniqueWhere,
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
  } catch (e) {
    if (!isUniqueViolation(e)) {
      throw e;
    }
    const winner = await tx.item.findUnique({
      where: uniqueWhere,
      select: { id: true, deleted_at: true, ignored_at: true },
    });
    if (!winner) {
      throw e;
    }
    return adoptExisting(tx, winner);
  }
}
