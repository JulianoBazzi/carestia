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
        heading: { value: 'var(--font-head), var(--font-sans), system-ui, sans-serif' },
        body: { value: 'var(--font-sans), system-ui, sans-serif' },
      },
    },
    // A paleta `teal` padrão do Chakra já corresponde aos tokens do design:
    // teal.600 = #0D9488 (primary), teal.700 = #0F766E (accent), teal.100 = #CCFBF1 (soft).
    // Aqui adicionamos apenas os tokens de superfície e de preço (alta/queda) que o design
    // define além do palette, com variantes light/dark para manter o dark mode.
    semanticTokens: {
      colors: {
        bg: {
          app: { value: { _light: '#F5F6F8', _dark: '{colors.gray.950}' } },
          surface: { value: { _light: '#FFFFFF', _dark: '{colors.gray.900}' } },
          sidebar: { value: { _light: '#101729', _dark: '#0B0F1A' } },
        },
        // Variação de preço: alta = vermelho, queda = teal (cf. tokens up/down do .pen).
        price: {
          up: { value: { _light: '#E5484D', _dark: '#FF6369' } },
          down: { value: { _light: '#0F766E', _dark: '#2DD4BF' } },
        },
        // Paleta "energy" (roxo do .pen, $energy #7C3AED) para contas de energia (NF3e).
        // Expõe os slots semânticos que o Chakra espera para `colorPalette="energy"`.
        energy: {
          solid: { value: { _light: '#7C3AED', _dark: '#8B5CF6' } },
          contrast: { value: { _light: '#FFFFFF', _dark: '#FFFFFF' } },
          fg: { value: { _light: '#6D28D9', _dark: '#C4B5FD' } },
          muted: { value: { _light: '#EFE9FE', _dark: '#2E1065' } },
          subtle: { value: { _light: '#F5F2FE', _dark: '#1E1033' } },
          emphasized: { value: { _light: '#DDD2FB', _dark: '#4C1D95' } },
          focusRing: { value: { _light: '#7C3AED', _dark: '#8B5CF6' } },
        },
      },
    },
    slotRecipes: {
      card: customCardRecipe,
    },
  },
});

export const system = createSystem(defaultConfig, config);
