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
  });

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

export default redis;
