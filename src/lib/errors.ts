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
