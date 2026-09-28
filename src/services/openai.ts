import 'server-only';
import OpenAI from 'openai';
import { DEFAULT_CATEGORIES } from '~/lib/categories';
import { isCatalogGtin, normalizeEan } from '~/lib/ean';

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
