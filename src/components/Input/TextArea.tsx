'use client';

import {
  Textarea as ChakraTextarea,
  type TextareaProps as ChakraTextareaProps,
  Field,
  Skeleton,
} from '@chakra-ui/react';
import type { Ref } from 'react';
import { shouldUppercase, wrapUppercase } from '~/components/Input/uppercase';

export interface ITextAreaProps extends ChakraTextareaProps {
  name: string;
  label?: string;
  error?: string;
  required?: boolean;
  loading?: boolean;
  /** Transforma o texto em MAIÚSCULA (sem acento) ao digitar. Default true. */
  uppercase?: boolean;
}

export function TextArea({
  name,
  label,
  error,
  required,
  loading,
  disabled,
  maxW,
  uppercase,
  onChange,
  ref,
  ...rest
}: ITextAreaProps & { ref?: Ref<HTMLTextAreaElement> }) {
  const hasError = !!error;
  const upper = shouldUppercase(uppercase);

  return (
    <Field.Root invalid={hasError} required={required} maxW={maxW}>
      {!!label && (
        <Field.Label htmlFor={name}>
          {label}
          {required && <Field.RequiredIndicator />}
        </Field.Label>
      )}
      {loading ? (
        <Skeleton height="24" w="100%" borderRadius="md" />
      ) : (
        <ChakraTextarea
          ref={ref}
          id={name}
          name={name}
          disabled={disabled}
          onChange={wrapUppercase(onChange, upper)}
          {...rest}
        />
      )}
      {hasError && <Field.ErrorText>{error}</Field.ErrorText>}
    </Field.Root>
  );
}
