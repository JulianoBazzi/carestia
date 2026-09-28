import { StatusCodes } from 'http-status-codes';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { BusinessError } from '~/lib/errors';
import { firstIssue } from '~/schemas/auth';

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Valida o corpo de uma request contra um schema Zod, reaproveitando os mesmos
 * schemas usados pelos formulários do client. Retorna a primeira mensagem de erro
 * (via `firstIssue`) para a rota responder 400 sem repetir validação à mão.
 */
export function parseBody<T>(schema: z.ZodType<T>, body: unknown): ParseResult<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    return { ok: false, error: firstIssue(result.error) };
  }
  return { ok: true, data: result.data };
}

/**
 * Envolve um handler de rota num try/catch que loga o erro e responde 500
 * padronizado, evitando que uma falha de DB/externa vire uma rejeição não tratada.
 */
export function safeRoute<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

/**
 * Resposta padronizada para erros em handlers de mutação. Encaminha apenas
 * mensagens de `BusinessError` (seguras) com o status apropriado; qualquer outro
 * erro (Prisma, inesperado) é logado no servidor e vira 500 genérico — evita
 * vazar texto interno de erro para o cliente.
 */
export function errorResponse(e: unknown): NextResponse {
  // Inclui `error` e `message`: as rotas/clientes leem campos diferentes.
  if (e instanceof BusinessError) {
    return NextResponse.json({ error: e.message, message: e.message }, { status: e.status });
  }
  console.error('[api] erro não tratado:', e);
  const msg = 'Erro interno. Tente novamente.';
  return NextResponse.json(
    { error: msg, message: msg },
    { status: StatusCodes.INTERNAL_SERVER_ERROR },
  );
}
