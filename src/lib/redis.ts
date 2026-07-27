import 'server-only';
import Redis from 'ioredis';

// Redis compartilhado entre apps no mesmo servidor: `keyPrefix` namespaceia todas
// as chaves do Carestia sob "carestia:" (ex.: `redis.set('ipca', ...)` grava
// `carestia:ipca`). Cada app usa o seu prefixo e nunca colidem.
//
// A instância de produção é `noeviction` (a fila não pode perder job), então toda
// chave de CACHE gravada aqui DEVE ter TTL — senão a memória cresce até falhar.
//
// ATENÇÃO: não reutilize este cliente para o BullMQ — o `keyPrefix` do ioredis
// conflita com o prefixo próprio do BullMQ. A fila usa conexão separada (sem
// `keyPrefix`) + a opção `prefix: 'carestia'`.

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
    keyPrefix: 'carestia:',
    // Não deixa comandos empilharem esperando um Redis que não conecta: falha
    // rápido e os helpers abaixo degradam para a fonte real (HTTP/DB).
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

/**
 * Lê um valor JSON do cache. Retorna `null` em miss OU em qualquer falha do Redis
 * — cache é otimização, nunca pode quebrar o fluxo que o usa.
 */
export async function cacheGetJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Grava um valor JSON com TTL (segundos). Obrigatório passar TTL — a instância é
 * `noeviction`. Engole erros do Redis (cache indisponível não pode quebrar nada).
 */
export async function cacheSetJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // no-op: segue sem cache.
  }
}

/** Remove uma chave do cache (invalidação). Engole erros do Redis. */
export async function cacheDel(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch {
    // no-op.
  }
}

export default redis;
