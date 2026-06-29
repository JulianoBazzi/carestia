'use client';

import {
  Input as ChakraInput,
  type InputProps as ChakraInputProps,
  Field,
  Skeleton,
} from '@chakra-ui/react';
import type { Ref } from 'react';

export interface IInputProps extends ChakraInputProps {
  name: string;
  label?: string;
  error?: string;
  required?: boolean;
  loading?: boolean;
}

export function Input({
  name,
  label,
  error,
  required,
  loading,
  disabled,
  maxW,
  ref,
  ...rest
}: IInputProps & { ref?: Ref<HTMLInputElement> }) {
  const hasError = !!error;

  return (
    <Field.Root invalid={hasError} required={required} maxW={maxW}>
      {!!label && (
        <Field.Label htmlFor={name}>
          {label}
          {required && <Field.RequiredIndicator />}
        </Field.Label>
      )}

      {loading ? (
        <Skeleton height="10" w="100%" borderRadius="md" />
      ) : (
        <ChakraInput
          ref={ref}
          id={name}
          name={name}
          autoComplete="off"
          disabled={disabled}
          {...rest}
        />
      )}

      {hasError && <Field.ErrorText mt="1">{error}</Field.ErrorText>}
    </Field.Root>
  );
}
