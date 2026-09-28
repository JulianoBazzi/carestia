interface IApiErrorShape {
  response?: { status?: number; data?: { message?: string; error?: string } };
  message?: string;
}

export const SESSION_EXPIRED_MESSAGE = 'Sua sessão expirou. Entre novamente para continuar.';

/**
 * Mensagem legível de um erro do axios. As rotas respondem com `message` ou
 * `error` (legado) — lê os dois. 401 vira o aviso de sessão expirada (o proxy
 * responde 401 em JSON para API sem cookie válido).
 */
export function apiErrorMessage(error: unknown, fallback = 'Ocorreu um erro inesperado.'): string {
  const e = error as IApiErrorShape | null | undefined;
  if (e?.response?.status === 401) {
    return SESSION_EXPIRED_MESSAGE;
  }
  return e?.response?.data?.message ?? e?.response?.data?.error ?? e?.message ?? fallback;
}
