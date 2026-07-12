import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import { isAdmin } from '~/lib/auth/admin';

/**
 * Rate limit simples de janela fixa, EM MEMÓRIA (por processo). Cobre bem uma
 * instância única (o cenário atual). Em produção serverless/multi-instância use
 * um store compartilhado (ex.: Upstash/Redis) — a contagem aqui não é global.
 */

interface Bucket {
  count: number;
  resetAt: number; // epoch ms
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(key);
  }
}

/** Extrai o IP do cliente dos headers de proxy (best-effort). */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): {
  ok: boolean;
  retryAfter: number; // segundos
} {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  return { ok: true, retryAfter: 0 };
}

/**
 * Aplica rate limit por IP+escopo. Retorna uma resposta 429 pronta se estourar,
 * ou `null` para seguir. Inclui `error` e `message` no corpo porque as rotas leem
 * campos diferentes. Admins são isentos: passe a sessão (quando existir) e a
 * checagem é pulada sem consumir a cota do IP.
 */
export function enforceRateLimit(
  req: Request,
  scope: string,
  limit: number,
  windowMs: number,
  session?: { type?: string | null } | null,
): NextResponse | null {
  if (isAdmin(session)) return null;
  const { ok, retryAfter } = checkRateLimit(`${scope}:${clientIp(req)}`, limit, windowMs);
  if (ok) return null;
  const msg = 'Muitas requisições. Aguarde um momento e tente novamente.';
  return NextResponse.json(
    { error: msg, message: msg },
    { status: StatusCodes.TOO_MANY_REQUESTS, headers: { 'Retry-After': String(retryAfter) } },
  );
}

/** Zera os buckets — só para testes. */
export function __resetRateLimit(): void {
  buckets.clear();
  lastSweep = 0;
}
