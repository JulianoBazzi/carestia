/**
 * Executa `worker` sobre `items` com no máximo `concurrency` em paralelo,
 * preservando a ordem dos resultados (results[i] corresponde a items[i]).
 * O primeiro erro rejeita o conjunto: os workers em voo terminam o item atual,
 * mas nenhum item novo é iniciado.
 *
 * Sem `server-only` de propósito: usado tanto no servidor (resolução de itens
 * da importação) quanto no cliente (envio de chunks de XML).
 */
export async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let failed = false;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (!failed && next < items.length) {
      const i = next++;
      try {
        results[i] = await worker(items[i], i);
      } catch (e) {
        failed = true;
        throw e;
      }
    }
  });
  await Promise.all(runners);
  return results;
}
