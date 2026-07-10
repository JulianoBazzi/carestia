// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { matchKey } from '~/lib/normalize';
import {
  findOrCreateItem,
  PRICE_MATCH_MAX_RATIO,
  priceWithinBand,
} from '~/services/invoice/item-matching';

function makeTx() {
  return {
    item: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: 'x' }),
      upsert: vi.fn().mockResolvedValue({ id: 'novo' }),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    // biome-ignore lint/suspicious/noExplicitAny: mock do client de transação
  } as any;
}

describe('findOrCreateItem — atalho por EAN', () => {
  let tx: ReturnType<typeof makeTx>;
  beforeEach(() => {
    tx = makeTx();
  });

  it('reaproveita o item pelo EAN, ignorando nome e preço', async () => {
    tx.item.findFirst.mockResolvedValue({ id: 'item-ean' });

    const id = await findOrCreateItem(tx, {
      type: 'product',
      reference_code: '10063021',
      name: 'NOME TOTALMENTE DIFERENTE',
      unit: 'UN',
      ean: '7891234567890',
      unitValue: 999,
    });

    expect(id).toBe('item-ean');
    // Confia no EAN: nem roda similaridade nem cria item.
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.item.upsert).not.toHaveBeenCalled();
  });

  it('ignora EAN inválido/"SEM GTIN" e cai no fluxo por nome', async () => {
    const id = await findOrCreateItem(tx, {
      type: 'product',
      reference_code: '22071090',
      name: 'ALCOOL ETILICO',
      unit: 'L',
      ean: 'SEM GTIN',
      unitValue: 3.68,
    });

    expect(tx.item.findFirst).not.toHaveBeenCalled();
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.item.upsert).toHaveBeenCalledTimes(1);
    expect(id).toBe('novo');
  });

  it('faz backfill do EAN em item casado por nome que ainda não tem GTIN', async () => {
    tx.$queryRaw.mockResolvedValue([{ id: 'item-nome', sim: 0.95, median_price: 25.0, ean: null }]);

    const id = await findOrCreateItem(tx, {
      type: 'product',
      reference_code: '10063021',
      name: 'ARROZ TIPO 1 5KG',
      unit: 'UN',
      ean: '7891234567890',
      unitValue: 25.9,
    });

    expect(id).toBe('item-nome');
    expect(tx.item.update).toHaveBeenCalledWith({
      where: { id: 'item-nome' },
      data: { ean: '7891234567890' },
    });
  });
});

describe('priceWithinBand', () => {
  const f = PRICE_MATCH_MAX_RATIO; // 5

  it('passa quando não há histórico (mediana nula)', () => {
    expect(priceWithinBand(6, null, f)).toBe(true);
    expect(priceWithinBand(6, undefined, f)).toBe(true);
  });

  it('passa para preços dentro da faixa (inflação/variação normal)', () => {
    expect(priceWithinBand(6, 6, f)).toBe(true);
    expect(priceWithinBand(7.2, 6, f)).toBe(true); // +20%
    expect(priceWithinBand(30, 6, f)).toBe(true); // 5× exato (limite)
    expect(priceWithinBand(6, 30, f)).toBe(true); // 1/5 exato (limite)
  });

  it('rejeita produtos de faixas incompatíveis (o caso 1000 vs 10)', () => {
    expect(priceWithinBand(1000, 10, f)).toBe(false);
    expect(priceWithinBand(10, 1000, f)).toBe(false);
    expect(priceWithinBand(60, 6, f)).toBe(false); // 10×
  });

  it('passa (não bloqueia) para valores inválidos ≤ 0', () => {
    expect(priceWithinBand(0, 6, f)).toBe(true);
    expect(priceWithinBand(-1, 6, f)).toBe(true);
    expect(priceWithinBand(6, 0, f)).toBe(true);
    expect(priceWithinBand(null, 6, f)).toBe(true);
  });
});

describe('matchKey', () => {
  it('colapsa variações de escrita do mesmo produto', () => {
    const variants = ['DIESEL S-10', 'DIESEL S10', 'Diesel S-10.', 'diesel  s-10'];
    const keys = variants.map(matchKey);
    for (const k of keys) {
      expect(k).toBe('DIESEL S10');
    }
  });

  it('remove acento, pontuação e espaços redundantes', () => {
    expect(matchKey('Óleo Diesel B S-10 - Comum')).toBe('OLEO DIESEL B S10 COMUM');
  });

  it('retorna string vazia para entrada vazia/nula', () => {
    expect(matchKey(null)).toBe('');
    expect(matchKey('')).toBe('');
    expect(matchKey('   ')).toBe('');
  });
});
