import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';
import { cardSlotRecipe } from '@chakra-ui/react/theme';

const customCardRecipe = {
  ...cardSlotRecipe,
  base: {
    ...cardSlotRecipe.base,
    root: {
      ...cardSlotRecipe.base?.root,
      borderRadius: 'xl',
      boxShadow: 'sm',
    },
  },
};

const config = defineConfig({
  theme: {
    tokens: {
      fonts: {
        heading: { value: 'var(--font-sans), system-ui, sans-serif' },
        body: { value: 'var(--font-sans), system-ui, sans-serif' },
      },
    },
    slotRecipes: {
      card: customCardRecipe,
    },
  },
});

export const system = createSystem(defaultConfig, config);
