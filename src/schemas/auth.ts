import { z } from 'zod';

/**
 * E-mail normalizado (trim + minúsculas): a unique do banco é case-sensitive, e
 * sem isso `Foo@x.com` e `foo@x.com` virariam duas contas.
 */
export const zemail = () =>
  z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email('E-mail inválido.').max(255, 'E-mail com no máximo 255 caracteres.'));

/** O bcrypt só considera os primeiros 72 bytes — acima disso a senha "encurta" calada. */
export const znewPassword = (label = 'Senha') =>
  z
    .string()
    .min(8, `${label} deve ter ao menos 8 caracteres.`)
    .max(72, `${label} deve ter no máximo 72 caracteres.`);

export const zname = () =>
  z.string().trim().min(1, 'Nome é obrigatório.').max(255, 'Nome com no máximo 255 caracteres.');

export const registerSchema = z.object({
  name: zname(),
  email: zemail(),
  password: znewPassword(),
});

export const loginSchema = z.object({
  email: zemail(),
  password: z.string().min(1, 'Senha é obrigatória.').max(200, 'Senha inválida.'),
});

export type RegisterInput = z.input<typeof registerSchema>;
export type LoginInput = z.input<typeof loginSchema>;

/** Primeira mensagem de erro de um ZodError (para resposta de API). */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Dados inválidos.';
}
