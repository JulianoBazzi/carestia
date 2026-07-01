'use client';

import { type ButtonProps, Button as ChakraButton } from '@chakra-ui/react';
import type { Ref } from 'react';

export function PrimaryButton({ ref, ...rest }: ButtonProps & { ref?: Ref<HTMLButtonElement> }) {
  return (
    <ChakraButton
      ref={ref}
      colorPalette="teal"
      bg="teal.600"
      color="white"
      borderRadius="md"
      fontWeight="semibold"
      _hover={{ bg: 'teal.700' }}
      _active={{ bg: 'teal.700', opacity: 0.9 }}
      {...rest}
    />
  );
}
