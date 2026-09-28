// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { mapPool } from '~/lib/concurrency';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('mapPool', () => {
  it('preserva a ordem dos resultados mesmo com términos fora de ordem', async () => {
    const delays = [30, 0, 10];
    const results = await mapPool(delays, 2, async (d, i) => {
      await sleep(d);
      return `${i}:${d}`;
    });
    expect(results).toEqual(['0:30', '1:0', '2:10']);
  });

  it('não excede o teto de concorrência', async () => {
    let inFlight = 0;
    let peak = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);
    await mapPool(items, 3, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await sleep(5);
      inFlight -= 1;
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1); // de fato rodou em paralelo
  });

  it('retorna vazio para lista vazia', async () => {
    const results = await mapPool([], 4, async () => 1);
    expect(results).toEqual([]);
  });

  it('propaga o primeiro erro e não inicia itens novos depois dele', async () => {
    const started: number[] = [];
    await expect(
      mapPool([1, 2, 3, 4], 2, async (n) => {
        started.push(n);
        if (n === 1) {
          throw new Error('boom');
        }
        await sleep(5);
        return n;
      }),
    ).rejects.toThrow('boom');
    // Os dois primeiros já estavam em voo quando o erro disparou; 3 e 4 não começam.
    expect(started).toEqual([1, 2]);
  });
});
