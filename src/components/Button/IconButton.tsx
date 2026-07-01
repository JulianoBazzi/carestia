'use client';

import { IconButton as ChakraIconButton, type IconButtonProps } from '@chakra-ui/react';
import type { Ref } from 'react';

export type ActionIconButtonProps = IconButtonProps & { ref?: Ref<HTMLButtonElement> };

/**
 * Botão de ícone para ações de linha (editar/excluir), espelhando o `IconBtn`
 * do design: quadrado ~34px, borda sutil e fundo neutro. Use `colorPalette="red"`
 * para a ação de excluir.
 */
export function ActionIconButton({ ref, ...rest }: ActionIconButtonProps) {
  return (
    <ChakraIconButton
      ref={ref}
      variant="outline"
      size="sm"
      borderRadius="lg"
      bg={{ base: 'bg.subtle', _dark: 'bg.muted' }}
      {...rest}
    />
  );
}
