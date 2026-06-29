'use client';

import { type ButtonProps, Button as ChakraButton } from '@chakra-ui/react';
import type { Ref } from 'react';

export function PrimaryButton({ ref, ...rest }: ButtonProps & { ref?: Ref<HTMLButtonElement> }) {
  return (
    <ChakraButton
      ref={ref}
      colorPalette="teal"
      bg="teal.500"
      color="white"
      borderRadius="md"
      _hover={{ opacity: 0.9 }}
      _active={{ opacity: 0.8 }}
      {...rest}
    />
  );
}
