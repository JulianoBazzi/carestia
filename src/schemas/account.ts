import { z } from 'zod';
import { zname, znewPassword } from '~/schemas/auth';

export const updateAccountSchema = z.object({
  name: zname(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória.').max(200, 'Senha inválida.'),
  newPassword: znewPassword('Nova senha'),
});

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
