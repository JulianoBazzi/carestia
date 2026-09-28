import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { isAdmin } from '~/lib/auth/admin';

/**
 * Rate limit simples de janela fixa, EM MEMÓRIA (por processo). Cobre bem uma
 * instância única (o cenário atual). Em produção serverless/multi-instância use
 * um store compartilhado (ex.: Upstash/Redis) — a contagem aqui não é global.
 *
 * A janela abre no PRIMEIRO hit (não é dia-calendário) e os contadores zeram a
 * cada deploy/restart. Para cotas de API paga isso é aceitável como salvaguarda,
 * não como contabilidade exata.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

interface Bucket {
  count: number;
  resetAt: number; // epoch ms
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < 60_000) {
    return;
  }
  lastSweep = now;
  for (const [key, b] of buckets) {
    if (now >= b.resetAt) {
      buckets.delete(key);
    }
  }
}

/**
 * IP do cliente a partir do `X-Forwarded-For`. O valor mais à ESQUERDA é
 * controlado pelo cliente (basta mandar o header forjado) — confiar nele
 * permitiria burlar qualquer limite trocando de "IP" a cada requisição. Cada
 * proxy anexa à direita o IP de quem o chamou, então o cliente real é o item
 * `TRUST_PROXY_HOPS` posições a partir da direita (padrão 1: um proxy de borda,
 * ex.: Vercel/nginx; use 2 atrás de Cloudflare + nginx).
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const hops = xff
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const trusted = Math.max(1, Number(process.env.TRUST_PROXY_HOPS) || 1);
    const ip = hops[Math.max(0, hops.length - trusted)];
    if (ip) {
      return ip;
    }
  }
  return req.headers.get('x-real-ip') ?? 'unknown';
}

/**
 * Consome `cost` unidades da cota de `key`. Falha (sem consumir) quando o total
 * ultrapassaria `limit` dentro da janela corrente.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  cost = 1,
): {
  ok: boolean;
  retryAfter: number; // segundos
} {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: cost, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count + cost > limit) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += cost;
  return { ok: true, retryAfter: 0 };
}

/**
 * Devolve `cost` unidades a `key` — quando uma etapa seguinte recusou a
 * requisição e a cota já debitada não pode ficar perdida.
 */
export function refundRateLimit(key: string, cost = 1): void {
  const b = buckets.get(key);
  if (b) {
    b.count = Math.max(0, b.count - cost);
  }
}

export interface IRateLimitOptions {
  /**
   * `ip` (padrão): chave `scope:ip`. `user`: chave `scope:user:<sub>` — cota por
   * conta, independente de rede; sem `sub` na sessão cai no IP.
   */
  by?: 'ip' | 'user';
  /** Unidades consumidas nesta chamada (ex.: nº de chaves numa importação). */
  cost?: number;
}

export function rateLimitResponse(retryAfter: number): NextResponse {
  const msg = 'Muitas requisições. Aguarde um momento e tente novamente.';
  return NextResponse.json(
    { error: msg, message: msg },
    { status: StatusCodes.TOO_MANY_REQUESTS, headers: { 'Retry-After': String(retryAfter) } },
  );
}

/**
 * Aplica rate limit por escopo (IP ou usuário). Retorna uma resposta 429 pronta
 * se estourar, ou `null` para seguir. Inclui `error` e `message` no corpo porque
 * as rotas leem campos diferentes. Admins são isentos: passe a sessão (quando
 * existir) e a checagem é pulada sem consumir a cota.
 */
export function enforceRateLimit(
  req: Request,
  scope: string,
  limit: number,
  windowMs: number,
  session?: { type?: string | null; sub?: string } | null,
  opts: IRateLimitOptions = {},
): NextResponse | null {
  if (isAdmin(session)) {
    return null;
  }
  const key =
    opts.by === 'user' && session?.sub
      ? `${scope}:user:${session.sub}`
      : `${scope}:${clientIp(req)}`;
  const { ok, retryAfter } = checkRateLimit(key, limit, windowMs, opts.cost ?? 1);
  if (ok) {
    return null;
  }
  return rateLimitResponse(retryAfter);
}

/** Zera os buckets — só para testes. */
export function __resetRateLimit(): void {
  buckets.clear();
  lastSweep = 0;
}
