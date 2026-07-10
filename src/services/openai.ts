import 'server-only';
import OpenAI from 'openai';
import { DEFAULT_CATEGORIES } from '~/lib/categories';

/**
 * Classificação de itens (produtos) em uma das categorias padrão via OpenAI.
 * Gated por `OPENAI_API_KEY`: sem a chave, `isAiEnabled()` retorna false e a UI
 * desabilita o botão "Categorizar com IA". Serviços/energia têm categoria óbvia
 * e nem chamam o modelo. Privacy-first: só o nome (genérico) + NCM saem daqui.
 */

const SLUGS = DEFAULT_CATEGORIES.map((c) => c.slug);

const SYSTEM_PROMPT = [
  'Você classifica um item de nota fiscal brasileira em UMA única categoria.',
  'Escolha exatamente um dos slugs abaixo:',
  ...DEFAULT_CATEGORIES.map((c) => `- ${c.slug}: ${c.name}`),
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
  if (!client) client = new OpenAI();
  return client;
}

/** Retorna o slug da categoria, ou `null` se indisponível/falha (degrada sem quebrar o lote). */
export async function categorizeItem(input: ICategorizeInput): Promise<string | null> {
  if (!isAiEnabled()) return null;

  // Categoria óbvia pelo tipo — evita uma chamada ao modelo.
  if (input.type === 'energy') return 'energy';
  if (input.type === 'service') return 'services';

  try {
    const completion = await getClient().chat.completions.create({
      model: 'gpt-5.6-terra',
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
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { category?: string };
    return parsed.category && SLUGS.includes(parsed.category) ? parsed.category : null;
  } catch {
    return null;
  }
}
