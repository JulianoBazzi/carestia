'use client';

import { Switch as ChakraSwitch } from '@chakra-ui/react';

export type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  colorPalette?: string;
  size?: 'sm' | 'md' | 'lg';
};

/**
 * Wrapper fino do `Switch` do Chakra v3 (componente Toggle do design).
 * Controlado: recebe `checked` e notifica via `onChange(checked)`.
 */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
  colorPalette = 'teal',
  size = 'md',
}: ToggleProps) {
  return (
    <ChakraSwitch.Root
      checked={checked}
      onCheckedChange={(e) => onChange(e.checked)}
      disabled={disabled}
      colorPalette={colorPalette}
      size={size}
    >
      <ChakraSwitch.HiddenInput />
      <ChakraSwitch.Control>
        <ChakraSwitch.Thumb />
      </ChakraSwitch.Control>
      {label && <ChakraSwitch.Label>{label}</ChakraSwitch.Label>}
    </ChakraSwitch.Root>
  );
}
