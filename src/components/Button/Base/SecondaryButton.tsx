'use client';

import { type ButtonProps, Button as ChakraButton } from '@chakra-ui/react';
import type { Ref } from 'react';

export function SecondaryButton({ ref, ...rest }: ButtonProps & { ref?: Ref<HTMLButtonElement> }) {
  return (
    <ChakraButton
      ref={ref}
      variant="outline"
      colorPalette="teal"
      color="teal.600"
      borderColor="teal.500"
      borderRadius="md"
      _hover={{ bg: 'teal.50' }}
      _active={{ opacity: 0.8 }}
      {...rest}
    />
  );
}
