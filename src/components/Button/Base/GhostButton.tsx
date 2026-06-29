'use client';

import { type ButtonProps, Button as ChakraButton } from '@chakra-ui/react';
import type { Ref } from 'react';

export function GhostButton({ ref, ...rest }: ButtonProps & { ref?: Ref<HTMLButtonElement> }) {
  return (
    <ChakraButton
      ref={ref}
      variant="ghost"
      colorPalette="teal"
      borderRadius="md"
      _hover={{ bg: 'teal.50' }}
      _active={{ bg: 'teal.100' }}
      {...rest}
    />
  );
}
