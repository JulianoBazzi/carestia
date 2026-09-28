import { z } from 'zod';

/**
 * Corpo de `POST /api/labels/read`: a foto da etiqueta como data URL JPEG. O
 * client reduz a imagem (lado maior ≤ 1280 px) antes de enviar; o teto aqui é
 * só uma salvaguarda contra payloads abusivos.
 */
export const labelReadSchema = z.object({
  image: z
    .string({ message: 'Envie a foto da etiqueta.' })
    .startsWith('data:image/jpeg;base64,', { message: 'Formato de imagem inválido.' })
    .max(2_000_000, { message: 'Imagem muito grande.' }),
});

export type LabelReadInput = z.infer<typeof labelReadSchema>;
