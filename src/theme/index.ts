import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

const config = defineConfig({
  theme: {
    tokens: {
      fonts: {
        heading: { value: 'var(--font-sans), system-ui, sans-serif' },
        body: { value: 'var(--font-sans), system-ui, sans-serif' },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
