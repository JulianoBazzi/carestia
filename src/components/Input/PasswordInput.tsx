'use client';

import {
  Input as ChakraInput,
  type InputProps as ChakraInputProps,
  Field,
  IconButton,
  InputGroup,
} from '@chakra-ui/react';
import { type Ref, useState } from 'react';
import { LuEye, LuEyeOff } from 'react-icons/lu';

export interface IPasswordInputProps extends ChakraInputProps {
  name: string;
  label?: string;
  error?: string;
  required?: boolean;
}

export function PasswordInput({
  name,
  label,
  error,
  required,
  autoComplete = 'current-password',
  ref,
  ...rest
}: IPasswordInputProps & { ref?: Ref<HTMLInputElement> }) {
  const [visible, setVisible] = useState(false);
  const hasError = !!error;

  return (
    <Field.Root invalid={hasError} required={required}>
      {!!label && (
        <Field.Label htmlFor={name}>
          {label}
          {required && <Field.RequiredIndicator />}
        </Field.Label>
      )}
      <InputGroup
        endElement={
          <IconButton
            variant="ghost"
            size="xs"
            aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
            onClick={() => setVisible((v) => !v)}
            tabIndex={-1}
            me="-1"
          >
            {visible ? <LuEyeOff /> : <LuEye />}
          </IconButton>
        }
      >
        <ChakraInput
          ref={ref}
          id={name}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          {...rest}
        />
      </InputGroup>
      {hasError && <Field.ErrorText mt="1">{error}</Field.ErrorText>}
    </Field.Root>
  );
}
