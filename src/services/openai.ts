import 'server-only';
import OpenAI from 'openai';
import { DEFAULT_CATEGORIES } from '~/lib/categories';
import { isCatalogGtin, normalizeEan } from '~/lib/ean';
import { isUf } from '~/lib/ufs';

/**
 * Classificação de itens (produtos) em uma das categorias padrão via OpenAI.
 * Gated por `OPENAI_API_KEY`: sem a chave, `isAiEnabled()` retorna false e a UI
 * desabilita o botão "Categorizar com IA". Serviços/energia têm categoria óbvia
 * e nem chamam o modelo. Privacy-first: só o nome (genérico) + NCM saem daqui.
 */

const MODEL = 'gpt-5.6-terra';

const SLUGS = DEFAULT_CATEGORIES.map((c) => c.slug);

const SYSTEM_PROMPT = [
  'Você classifica um item de nota fiscal brasileira em UMA única categoria.',
  'Escolha exatamente um dos slugs abaixo:',
  ...DEFAULT_CATEGORIES.map((c) => `- ${c.slug}: ${c.name}`),
  'Prefira SEMPRE a categoria mais específica: um produto de supermercado deve cair em',
  'produce/meat/dairy/bakery/frozen/beverages/groceries/cleaning/hygiene/pharmacy/pet,',
  'e não na categoria abrangente "food" ou "household".',
  'Se não tiver certeza, use "other".',
].join('\n');

export function isAiEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export interface ICategorizeInput {
  name: string;
  referenceCode: string; // NCM (produto)
  type: string; // 'product' | 'service' | 'energy'
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  // O padrão do SDK é 10 min + 2 retries: uma leitura de etiqueta travada
  // seguraria a requisição do usuário (e a cota) por muito tempo.
  client ??= new OpenAI({ timeout: 20_000, maxRetries: 1 });
  return client;
}

/** Retorna o slug da categoria, ou `null` se indisponível/falha (degrada sem quebrar o lote). */
export async function categorizeItem(input: ICategorizeInput): Promise<string | null> {
  if (!isAiEnabled()) {
    return null;
  }

  // Categoria óbvia pelo tipo — evita uma chamada ao modelo.
  if (input.type === 'energy') {
    return 'energy';
  }
  if (input.type === 'service') {
    return 'services';
  }

  try {
    const completion = await getClient().chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Produto: "${input.name}". NCM: ${input.referenceCode}.` },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'categoria',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: { category: { type: 'string', enum: SLUGS } },
            required: ['category'],
          },
        },
      },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { category?: string };
    return parsed.category && SLUGS.includes(parsed.category) ? parsed.category : null;
  } catch {
    return null;
  }
}

/**
 * Leitura de etiqueta de gôndola (foto tirada no scanner): extrai código de
 * barras, preço, nome e unidade via visão do modelo. Privacy-first: a imagem vai
 * para a OpenAI só para a leitura e NÃO é armazenada por nós; o que volta são
 * quatro campos, todos opcionais.
 */
export interface IPriceLabelReading {
  ean: string | null;
  price: number | null; // reais
  name: string | null;
  unit: string | null;
}

const LABEL_PROMPT = [
  'Você lê a foto de UMA etiqueta de preço de gôndola de supermercado brasileiro.',
  'Extraia:',
  '- ean: os dígitos impressos sob o código de barras do produto (8, 12, 13 ou 14 dígitos).',
  '- price: o preço de VENDA do produto em reais, como número (ex.: "R$ 12,99" → 12.99).',
  '  Ignore o preço comparativo por kg/L/100g e preços "de"/riscados; em oferta, use o preço atual.',
  '- name: a descrição do produto como impressa, incluindo marca e tamanho da embalagem.',
  '- unit: a unidade de venda quando explícita (UN, KG, L, PCT…); senão null.',
  'Use null em qualquer campo que não esteja legível ou do qual você não tenha certeza.',
  'Nunca invente dígitos do código de barras.',
].join('\n');

const LABEL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ean: { type: ['string', 'null'] },
    price: { type: ['number', 'null'] },
    name: { type: ['string', 'null'] },
    unit: { type: ['string', 'null'] },
  },
  required: ['ean', 'price', 'name', 'unit'],
} as const;

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const out = value.replace(/\s+/g, ' ').trim().slice(0, max);
  return out || null;
}

/**
 * Valida o que o modelo devolveu: EAN só passa com dígito verificador correto
 * (modelos trocam dígitos com facilidade) e preço só se for finito e positivo.
 */
export function sanitizeLabelReading(raw: unknown): IPriceLabelReading {
  const r = (raw ?? {}) as Record<string, unknown>;
  const ean = typeof r.ean === 'string' ? normalizeEan(r.ean) : '';
  const price =
    typeof r.price === 'number' && Number.isFinite(r.price) && r.price > 0 ? r.price : null;
  return {
    ean: isCatalogGtin(ean) ? ean : null,
    price: price !== null ? Math.round(price * 100) / 100 : null,
    name: cleanText(r.name, 255),
    unit: cleanText(r.unit, 10),
  };
}

/**
 * Lê a etiqueta a partir de um data URL JPEG. Retorna `null` se a IA estiver
 * indisponível ou a chamada falhar (a rota traduz em erro amigável).
 */
export async function readPriceLabel(imageDataUrl: string): Promise<IPriceLabelReading | null> {
  if (!isAiEnabled()) {
    return null;
  }

  try {
    const response = await getClient().responses.create({
      model: MODEL,
      input: [
        { role: 'system', content: LABEL_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Leia esta etiqueta de preço.' },
            { type: 'input_image', image_url: imageDataUrl, detail: 'auto' },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'etiqueta_preco',
          strict: true,
          schema: LABEL_SCHEMA,
        },
      },
    });

    const raw = response.output_text;
    if (!raw) {
      return null;
    }
    return sanitizeLabelReading(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Leitura de encarte/panfleto de supermercado (print de WhatsApp/Instagram):
 * vários produtos por imagem. Só-admin. O preço lido é o "por" aberto a
 * qualquer cliente — preço de clube/cartão é ignorado — e o "de" riscado vem à
 * parte. Encarte quase nunca traz EAN: o item é casado pelo nome na revisão.
 * A imagem vai para a OpenAI só para a leitura e NÃO é armazenada.
 */
export interface IFlyerItemReading {
  name: string;
  unit: string | null;
  price: number; // reais, o "por"
  regular_price: number | null; // reais, o "de" riscado
  /** Condição para valer o preço ("leve 4 pague 3", "compre 2 ou +"). */
  condition: string | null;
  /** Um preço só para todas as variantes/sabores ("(TODOS)"). */
  all_variants: boolean;
}

export interface IFlyerReading {
  store: string | null;
  valid_from: string | null; // yyyy-mm-dd
  valid_until: string | null; // yyyy-mm-dd
  /** Região como impressa ("lojas do Mato Grosso do Sul", "Dourados, Naviraí…"). */
  region_text: string | null;
  state: string | null;
  cities: string[];
  items: IFlyerItemReading[];
}

/** Teto de itens por imagem — um encarte denso tem ~20; o resto é ruído. */
export const FLYER_MAX_ITEMS = 100;
const FLYER_MAX_CITIES = 10;
/** Encarte denso em `detail: high` demora bem mais que uma etiqueta. */
const FLYER_TIMEOUT_MS = 90_000;

function flyerPrompt(today: string): string {
  return [
    'Você lê a imagem de um encarte/panfleto de ofertas de supermercado brasileiro.',
    `Hoje é ${today} (yyyy-mm-dd).`,
    '',
    'Cabeçalho:',
    '- store: nome da rede/loja (logo ou rodapé), ou null.',
    '- valid_from / valid_until: período de validade das ofertas em yyyy-mm-dd. Quando faltar o',
    '  ano ou o mês inicial ("válidas de 30 a 02 de Outubro"), deduza pela data de hoje',
    '  (30/09 → 02/10 do ano corrente). Oferta de um dia só: as duas datas iguais. Sem validade: null.',
    '- region_text: a região onde as ofertas valem, como impressa; null se não houver.',
    '- state: a sigla da UF quando a região indicar um estado ou cidades de um estado; senão null.',
    '- cities: as cidades citadas explicitamente na região; [] se não houver.',
    '',
    'Itens — um por produto com preço legível:',
    '- name: descrição com tipo, marca e tamanho/peso, como impressa (ex.: "Arroz Rampinelli Tipo 1 5kg").',
    '  Corrija erros óbvios de tamanho (iogurte "1,2G" é 1,2kg).',
    '- unit: unidade de venda do preço (kg, un, pct, bdj, l…). "cada" é un.',
    '- member_price: o preço exclusivo de clube/fidelidade/app/cartão da loja, quando existir; senão null.',
    '  Ele vem junto de um selo ou rótulo do programa ("Clube +amigo", "Cliente +Tropical",',
    '  "pagando com cartão X") e costuma ser o número MAIOR e mais chamativo do anúncio.',
    '- price: o preço de venda ATUAL aberto a qualquer cliente, como número (R$ 6,59 → 6.59). Quando',
    '  houver member_price, price é o OUTRO preço do mesmo produto — muitas vezes impresso pequeno, num',
    '  círculo ou etiqueta ao lado do selo do clube. Nunca repita o member_price em price; se só houver',
    '  o preço de clube, price = null.',
    '- regular_price: o preço "de" (riscado, "de R$ X por") quando existir; senão null.',
    '- condition: condição de QUANTIDADE para valer o price ("leve 4 pague 3", "compre 2 ou +",',
    '  "a partir de 3 un"); null quando o price vale para uma unidade comprada sozinha. Clube, app ou',
    '  cartão NÃO são condição (isso é member_price).',
    '- all_variants: true quando o preço vale para várias variantes sem listá-las ("(TODOS)", "sabores").',
    '',
    'Regras:',
    '- Variantes listadas explicitamente ("Trad/Ext", "Int/Desn/Semi", "Coco/Leite") viram um item por',
    '  variante, com o mesmo preço.',
    '- Ignore ofertas de categoria inteira sem produto específico ("toda categoria de massas").',
    '- Ignore preço comparativo por kg/L/100g e o valor por unidade de um multipack promocional.',
    '- Imagem sem produtos com preço (banner, capa): items = [].',
    '- Nunca invente produtos nem preços; pule o que não estiver legível.',
  ].join('\n');
}

const nullableString = { type: ['string', 'null'] } as const;
const nullableNumber = { type: ['number', 'null'] } as const;

const FLYER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    store: nullableString,
    valid_from: nullableString,
    valid_until: nullableString,
    region_text: nullableString,
    state: nullableString,
    cities: { type: 'array', items: { type: 'string' } },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          unit: nullableString,
          price: nullableNumber,
          regular_price: nullableNumber,
          // Só para o modelo separar os dois preços; descartado em `sanitizeFlyerReading`.
          member_price: nullableNumber,
          condition: nullableString,
          all_variants: { type: 'boolean' },
        },
        required: [
          'name',
          'unit',
          'price',
          'regular_price',
          'member_price',
          'condition',
          'all_variants',
        ],
      },
    },
  },
  required: ['store', 'valid_from', 'valid_until', 'region_text', 'state', 'cities', 'items'],
} as const;

function cleanPrice(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value >= 1_000_000) {
    return null;
  }
  return Math.round(value * 100) / 100;
}

/** "yyyy-mm-dd" de um dia que existe no calendário; senão `null`. */
function cleanDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value ? value : null;
}

/**
 * Valida o que o modelo devolveu: item sem nome ou sem preço positivo cai fora;
 * o "de" só fica se for maior que o "por" (senão não é preço riscado); datas e
 * UF inválidas viram null. Textos cortados no tamanho das colunas.
 */
export function sanitizeFlyerReading(raw: unknown): IFlyerReading {
  const r = (raw ?? {}) as Record<string, unknown>;
  const rawItems = Array.isArray(r.items) ? r.items : [];
  const items: IFlyerItemReading[] = [];
  for (const it of rawItems) {
    const i = (it ?? {}) as Record<string, unknown>;
    const name = cleanText(i.name, 255);
    const price = cleanPrice(i.price);
    if (!name || price === null) {
      continue;
    }
    const regular = cleanPrice(i.regular_price);
    items.push({
      name,
      unit: cleanText(i.unit, 10),
      price,
      regular_price: regular !== null && regular > price ? regular : null,
      condition: cleanText(i.condition, 120),
      all_variants: i.all_variants === true,
    });
    if (items.length >= FLYER_MAX_ITEMS) {
      break;
    }
  }

  const state = typeof r.state === 'string' ? r.state.trim().toUpperCase() : '';
  const cities = (Array.isArray(r.cities) ? r.cities : [])
    .map((c) => cleanText(c, 255))
    .filter((c): c is string => c !== null)
    .slice(0, FLYER_MAX_CITIES);
  let validFrom = cleanDate(r.valid_from);
  let validUntil = cleanDate(r.valid_until);
  if (validFrom && validUntil && validFrom > validUntil) {
    [validFrom, validUntil] = [validUntil, validFrom];
  }

  return {
    store: cleanText(r.store, 120),
    valid_from: validFrom,
    valid_until: validUntil,
    region_text: cleanText(r.region_text, 255),
    state: isUf(state) ? state : null,
    cities,
    items,
  };
}

/**
 * Lê um encarte a partir de um data URL JPEG. `today` (yyyy-mm-dd, BRT) ancora a
 * validade sem ano. Retorna `null` se a IA estiver indisponível ou a chamada falhar.
 */
export async function readFlyer(
  imageDataUrl: string,
  today: string,
): Promise<IFlyerReading | null> {
  if (!isAiEnabled()) {
    return null;
  }

  try {
    const response = await getClient().responses.create(
      {
        model: MODEL,
        input: [
          { role: 'system', content: flyerPrompt(today) },
          {
            role: 'user',
            content: [
              { type: 'input_text', text: 'Leia os produtos e preços deste encarte.' },
              // Encarte denso tem letra miúda: `auto` costuma reduzir demais.
              { type: 'input_image', image_url: imageDataUrl, detail: 'high' },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'encarte',
            strict: true,
            schema: FLYER_SCHEMA,
          },
        },
      },
      // Sem retry: uma segunda tentativa dobraria a espera do admin (e o custo).
      { timeout: FLYER_TIMEOUT_MS, maxRetries: 0 },
    );

    const raw = response.output_text;
    if (!raw) {
      return null;
    }
    return sanitizeFlyerReading(JSON.parse(raw));
  } catch {
    return null;
  }
}
