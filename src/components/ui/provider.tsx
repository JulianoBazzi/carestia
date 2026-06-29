'use client';

import { ChakraProvider } from '@chakra-ui/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { z } from 'zod';
import { ColorModeProvider, type ColorModeProviderProps } from '~/components/ui/color-mode';
import { Toaster } from '~/components/ui/toaster';
import { FeedbackProvider } from '~/contexts/FeedbackContext';
import { queryClient } from '~/services/queryClient';
import { system } from '~/theme';

z.config({
  ...z.locales.pt(),
  customError: (issue) => {
    if (issue.code === 'too_small' && issue.minimum === 1) {
      return 'Obrigatório';
    }
    return undefined;
  },
});

export function Provider(props: ColorModeProviderProps) {
  return (
    <ChakraProvider value={system}>
      <QueryClientProvider client={queryClient}>
        <FeedbackProvider>
          <ColorModeProvider {...props} />
          <Toaster />
        </FeedbackProvider>
      </QueryClientProvider>
    </ChakraProvider>
  );
}
