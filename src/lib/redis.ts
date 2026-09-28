import 'server-only';
import Redis from 'ioredis';

// Redis compartilhado entre apps no mesmo servidor: `keyPrefix` namespaceia todas
// as chaves do Carestia sob "carestia:" (ex.: `redis.set('ipca', ...)` grava
// `carestia:ipca`). Cada app usa o seu prefixo e nunca colidem.
//
// A instância de produção é `noeviction`, então toda chave gravada aqui DEVE ter
// TTL — senão a memória cresce até a instância falhar (derrubando os outros apps
// junto).
//
// ATENÇÃO: se um dia entrar uma fila (BullMQ), ela precisa de conexão PRÓPRIA —
// o `keyPrefix` do ioredis conflita com o prefixo interno do BullMQ.

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

const isNewClient = !globalForRedis.redis;

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

if (isNewClient) {
  // Sem listener, o ioredis despeja "Unhandled error event" a cada tentativa de
  // reconexão enquanto o Redis está fora. Um aviso por queda basta — os helpers
  // abaixo já degradam para a fonte real.
  let warned = false;
  redis.on('error', (err: Error) => {
    if (!warned) {
      warned = true;
      console.warn(`[redis] indisponível, seguindo sem cache: ${err.message}`);
    }
  });
  redis.on('ready', () => {
    warned = false;
  });
}

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

// Teto de espera pela conexão. Passado ele o comando segue e falha rápido (o
// cache degrada para a fonte real) — importar nota nunca espera por Redis.
const CONNECT_WAIT_MS = 1_000;

let connecting: Promise<unknown> | null = null;

/**
 * Garante que o socket esteja pronto ANTES do primeiro comando.
 *
 * `lazyConnect` + `enableOfflineQueue: false` se mordem: o ioredis dispara o
 * `connect()` no primeiro comando mas NÃO o espera, e rejeita tudo o que chegar
 * antes do socket ficar pronto ("Stream isn't writeable..."). Como os helpers
 * abaixo engolem erros, a perda é silenciosa — medido: uma rajada de 30 leituras
 * logo após o boot perdia as 30. Numa importação isso significa a primeira
 * remessa de notas inteira sem cache (BrasilAPI + findUnique por nota).
 *
 * Mantemos as duas opções (fast-fail com Redis fora, sem conectar no build) e
 * pagamos a espera só uma vez por processo.
 */
async function ensureConnected(): Promise<void> {
  if (redis.status === 'ready') {
    return;
  }

  // Uma tentativa NOSSA em voo: a rajada inteira compartilha a mesma espera (é
  // isto que salva o primeiro lote de notas — enquanto o 1º comando conecta, os
  // outros 29 esperam em vez de serem rejeitados).
  if (connecting) {
    await capped(connecting);
    return;
  }

  // 'wait' (lazyConnect, nunca conectou) ou 'end' (conexão encerrada): abre.
  if (redis.status === 'wait' || redis.status === 'end') {
    // `connect()` resolve no 'ready' e rejeita no 'close' (medido: ~1ms com o
    // Redis fora).
    connecting = redis
      .connect()
      .catch(() => undefined)
      .finally(() => {
        connecting = null;
      });
    await capped(connecting);
    return;
  }

  // 'connecting'/'reconnecting' SEM tentativa nossa em voo = o ioredis está
  // reconectando sozinho depois de uma queda. Aqui NÃO se espera: o Redis é
  // sabidamente ruim no momento e esperar o próximo ciclo de retry custava
  // ~500ms por operação (medido: 10,5s para 20 operações). O comando segue e
  // falha rápido; quando o ioredis voltar ao 'ready' o caminho rápido volta
  // sozinho.
}

/**
 * Espera a conexão com teto. Um servidor que aceita o socket mas nunca responde
 * ao ready check deixa `connect()` pendente para sempre — sem teto a importação
 * inteira ficaria presa esperando um cache. Ao estourar, larga a tentativa para
 * os próximos comandos não pagarem o teto de novo.
 */
async function capped(attempt: Promise<unknown>): Promise<void> {
  const timedOut = await Promise.race([
    attempt.then(() => false),
    delay(CONNECT_WAIT_MS).then(() => true),
  ]);
  if (timedOut) {
    connecting = null;
  }
}

/** Espera `ms` sem segurar o processo vivo (`unref`). */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms).unref?.();
  });
}

/**
 * Lê um valor JSON do cache. Retorna `null` em miss OU em qualquer falha do Redis
 * — cache é otimização, nunca pode quebrar o fluxo que o usa.
 */
export async function cacheGetJson<T>(key: string): Promise<T | null> {
  try {
    await ensureConnected();
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
    await ensureConnected();
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // no-op: segue sem cache.
  }
}

/** Remove uma chave do cache (invalidação). Engole erros do Redis. */
export async function cacheDel(key: string): Promise<void> {
  try {
    await ensureConnected();
    await redis.del(key);
  } catch {
    // no-op.
  }
}

export default redis;
