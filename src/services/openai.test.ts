// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { responsesCreate } = vi.hoisted(() => ({ responsesCreate: vi.fn() }));

vi.mock('openai', () => ({
  default: class {
    responses = { create: responsesCreate };
    chat = { completions: { create: vi.fn() } };
  },
}));

import { readPriceLabel, sanitizeLabelReading } from '~/services/openai';

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
