import { z } from 'zod';

export const updateAccountSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório.'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória.'),
  newPassword: z.string().min(6, 'Nova senha deve ter ao menos 6 caracteres.'),
});

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
