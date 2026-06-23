import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Só aplica o polyfill no ambiente jsdom (testes node não têm `window`).
if (typeof window !== 'undefined') {
  // jsdom não implementa matchMedia; next-themes/Chakra dependem dele.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}
