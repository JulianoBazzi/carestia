import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório.'),
  email: z.email('E-mail inválido.'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres.'),
});

export const loginSchema = z.object({
  email: z.email('E-mail inválido.'),
  password: z.string().min(1, 'Senha é obrigatória.'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/** Primeira mensagem de erro de um ZodError (para resposta de API). */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Dados inválidos.';
}
