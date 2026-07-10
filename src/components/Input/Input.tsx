'use client';

import {
  Input as ChakraInput,
  type InputProps as ChakraInputProps,
  Field,
  Skeleton,
} from '@chakra-ui/react';
import type { Ref } from 'react';
import { shouldUppercase, wrapUppercase } from '~/components/Input/uppercase';

export interface IInputProps extends ChakraInputProps {
  name: string;
  label?: string;
  error?: string;
  required?: boolean;
  loading?: boolean;
  /** Transforma o texto em MAIÚSCULA (sem acento) ao digitar. Default true para texto livre. */
  uppercase?: boolean;
}

export function Input({
  name,
  label,
  error,
  required,
  loading,
  disabled,
  maxW,
  uppercase,
  type,
  onChange,
  ref,
  ...rest
}: IInputProps & { ref?: Ref<HTMLInputElement> }) {
  const hasError = !!error;
  const upper = shouldUppercase(uppercase, type);

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
          type={type}
          autoComplete="off"
          disabled={disabled}
          onChange={wrapUppercase(onChange, upper)}
          {...rest}
        />
      )}

      {hasError && <Field.ErrorText mt="1">{error}</Field.ErrorText>}
    </Field.Root>
  );
}
