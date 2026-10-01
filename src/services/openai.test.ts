// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { responsesCreate } = vi.hoisted(() => ({ responsesCreate: vi.fn() }));

vi.mock('openai', () => ({
  default: class {
    responses = { create: responsesCreate };
    chat = { completions: { create: vi.fn() } };
  },
}));

import {
  FLYER_MAX_ITEMS,
  readFlyer,
  readPriceLabel,
  sanitizeFlyerReading,
  sanitizeLabelReading,
} from '~/services/openai';

const IMAGE = 'data:image/jpeg;base64,AAAA';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('OPENAI_API_KEY', 'test-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('sanitizeLabelReading', () => {
  it('mantém EAN com DV válido e arredonda o preço a centavos', () => {
    expect(
      sanitizeLabelReading({
        ean: '789 1000 315507',
        price: 12.994,
        name: '  LEITE   MOCA 395G ',
        unit: 'UN',
      }),
    ).toEqual({ ean: '7891000315507', price: 12.99, name: 'LEITE MOCA 395G', unit: 'UN' });
  });

  it('descarta EAN com dígito verificador errado e preço não positivo', () => {
    expect(sanitizeLabelReading({ ean: '7891000315508', price: 0, name: '', unit: null })).toEqual({
      ean: null,
      price: null,
      name: null,
      unit: null,
    });
  });

  it('tolera resposta vazia/malformada', () => {
    expect(sanitizeLabelReading(null)).toEqual({ ean: null, price: null, name: null, unit: null });
    expect(sanitizeLabelReading({ price: 'caro' })).toMatchObject({ price: null });
  });
});

describe('readPriceLabel', () => {
  it('envia a imagem como input_image e devolve a leitura validada', async () => {
    responsesCreate.mockResolvedValue({
      output_text: JSON.stringify({
        ean: '7891000315507',
        price: 7.49,
        name: 'LEITE CONDENSADO',
        unit: null,
      }),
    });

    const reading = await readPriceLabel(IMAGE);

    expect(reading).toEqual({
      ean: '7891000315507',
      price: 7.49,
      name: 'LEITE CONDENSADO',
      unit: null,
    });
    const args = responsesCreate.mock.calls[0][0];
    expect(args.input[1].content[1]).toMatchObject({ type: 'input_image', image_url: IMAGE });
    expect(args.text.format).toMatchObject({ type: 'json_schema', strict: true });
  });

  it('degrada para null quando a chamada falha ou vem vazia', async () => {
    responsesCreate.mockRejectedValueOnce(new Error('boom'));
    expect(await readPriceLabel(IMAGE)).toBeNull();

    responsesCreate.mockResolvedValueOnce({ output_text: '' });
    expect(await readPriceLabel(IMAGE)).toBeNull();
  });

  it('sem OPENAI_API_KEY nem chama o modelo', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    expect(await readPriceLabel(IMAGE)).toBeNull();
    expect(responsesCreate).not.toHaveBeenCalled();
  });
});

const flyerItem = (over: Record<string, unknown> = {}) => ({
  name: 'Arroz Rampinelli Tipo 1 5kg',
  unit: 'un',
  price: 17.89,
  regular_price: null,
  condition: null,
  all_variants: false,
  ...over,
});

describe('sanitizeFlyerReading', () => {
  it('mantém itens válidos e o cabeçalho, normalizando UF e preço', () => {
    const out = sanitizeFlyerReading({
      store: 'Amigão',
      valid_from: '2026-09-30',
      valid_until: '2026-10-02',
      region_text: 'Dourados, Naviraí e Três Lagoas',
      state: 'ms',
      cities: ['Dourados', ' Naviraí ', ''],
      items: [flyerItem({ price: 17.899, regular_price: 22.49 })],
    });
    expect(out).toMatchObject({
      store: 'Amigão',
      valid_from: '2026-09-30',
      valid_until: '2026-10-02',
      state: 'MS',
      cities: ['Dourados', 'Naviraí'],
    });
    expect(out.items).toEqual([flyerItem({ price: 17.9, regular_price: 22.49 })]);
  });

  it('descarta item sem nome/preço e "de" que não é maior que o "por"', () => {
    const out = sanitizeFlyerReading({
      items: [
        flyerItem({ name: '' }),
        flyerItem({ price: 0 }),
        flyerItem({ price: null }),
        flyerItem({ price: 9.98, regular_price: 9.98 }),
      ],
    });
    expect(out.items).toHaveLength(1);
    expect(out.items[0].regular_price).toBeNull();
  });

  it('invalida data/UF malformadas e desinverte o período', () => {
    expect(sanitizeFlyerReading({ valid_from: '2026-02-30', state: 'XX' })).toMatchObject({
      valid_from: null,
      state: null,
    });
    expect(
      sanitizeFlyerReading({ valid_from: '2026-10-02', valid_until: '2026-09-30' }),
    ).toMatchObject({ valid_from: '2026-09-30', valid_until: '2026-10-02' });
  });

  it('limita a quantidade de itens e tolera resposta malformada', () => {
    const many = Array.from({ length: FLYER_MAX_ITEMS + 5 }, () => flyerItem());
    expect(sanitizeFlyerReading({ items: many }).items).toHaveLength(FLYER_MAX_ITEMS);
    expect(sanitizeFlyerReading(null)).toMatchObject({ items: [], cities: [], state: null });
  });
});

describe('readFlyer', () => {
  it('manda a imagem em alta resolução com a data de hoje no prompt, sem retry', async () => {
    responsesCreate.mockResolvedValue({
      output_text: JSON.stringify({
        store: null,
        valid_from: null,
        valid_until: null,
        region_text: null,
        state: null,
        cities: [],
        items: [flyerItem()],
      }),
    });

    const reading = await readFlyer(IMAGE, '2026-10-01');

    expect(reading?.items).toHaveLength(1);
    const [args, options] = responsesCreate.mock.calls[0];
    expect(args.input[0].content).toContain('2026-10-01');
    expect(args.input[1].content[1]).toMatchObject({ type: 'input_image', detail: 'high' });
    expect(options).toMatchObject({ maxRetries: 0 });
  });

  it('degrada para null em falha ou sem chave', async () => {
    responsesCreate.mockRejectedValueOnce(new Error('timeout'));
    expect(await readFlyer(IMAGE, '2026-10-01')).toBeNull();

    vi.stubEnv('OPENAI_API_KEY', '');
    expect(await readFlyer(IMAGE, '2026-10-01')).toBeNull();
    expect(responsesCreate).toHaveBeenCalledTimes(1);
  });
});
