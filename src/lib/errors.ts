/**
 * Erro de validação de regra de negócio, com mensagem SEGURA para exibir ao
 * usuário. Rotas encaminham `BusinessError.message` (400 por padrão); qualquer
 * outro erro (Prisma, bug inesperado) vira 500 genérico — sem vazar detalhes.
 */
export class BusinessError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'BusinessError';
    this.status = status;
  }
}

/**
 * Violação de unique do Prisma (P2002). Duck-typing em vez de `instanceof`
 * para não carregar o client gerado em quem só precisa da checagem.
 */
export function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === 'P2002'
  );
}
