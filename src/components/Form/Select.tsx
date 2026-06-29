'use client';

import { Field, NativeSelect } from '@chakra-ui/react';
import type { Ref } from 'react';
import type ISelectOption from '~/models/ISelectOption';

export interface ISelectProps {
  name: string;
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  maxW?: string | string[];
  size?: 'sm' | 'md' | 'lg';
  options: ISelectOption[];
  value?: string;
  onChange: (value: string) => void;
}

export function Select({
  name,
  label,
  error,
  required,
  disabled,
  placeholder,
  maxW,
  size = 'sm',
  options,
  value,
  onChange,
  ref,
}: ISelectProps & { ref?: Ref<HTMLSelectElement> }) {
  const hasError = !!error;

  return (
    <Field.Root invalid={hasError} required={required} maxW={maxW}>
      {!!label && (
        <Field.Label htmlFor={name}>
          {label}
          {required && <Field.RequiredIndicator />}
        </Field.Label>
      )}
      <NativeSelect.Root size={size} disabled={disabled}>
        <NativeSelect.Field
          ref={ref}
          id={name}
          name={name}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
      {hasError && <Field.ErrorText>{error}</Field.ErrorText>}
    </Field.Root>
  );
}
