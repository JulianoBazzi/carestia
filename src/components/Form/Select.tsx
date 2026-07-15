'use client';

import { Field, Skeleton } from '@chakra-ui/react';
import { Select as ChakraReactSelect } from 'chakra-react-select';
import type ISelectOption from '~/models/ISelectOption';

export interface ISelectProps {
  name: string;
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  maxW?: string | string[];
  size?: 'sm' | 'md' | 'lg';
  variant?: 'outline' | 'subtle';
  menuPlacement?: 'auto' | 'top' | 'bottom';
  /** Permite filtrar as opções digitando. Default true. */
  searchable?: boolean;
  /** Mostra o botão de limpar (volta para `null`). */
  clearable?: boolean;
  autoFocus?: boolean;
  /**
   * Renderiza o menu num portal no body — necessário dentro de containers com
   * overflow (ex.: células de tabela). NÃO usar dentro de dialogs: o menu
   * portalado ficaria disputando empilhamento com o modal.
   */
  usePortal?: boolean;
  /** Fundo do controle (ex.: 'bg.surface' em barras de filtro). */
  bg?: string;
  options: ISelectOption[];
  value?: string | null;
  onChange: (value: string | null) => void;
}

/**
 * Select síncrono (opções em memória) sobre chakra-react-select, com contrato
 * de valor por string: recebe/emite o `value` da opção, resolvendo o objeto
 * internamente — encaixa direto em estados e forms que guardam ids.
 */
export function Select({
  name,
  label,
  error,
  required,
  disabled,
  loading,
  placeholder = 'Selecione…',
  maxW,
  size = 'md',
  variant,
  menuPlacement = 'auto',
  searchable = true,
  clearable,
  autoFocus,
  usePortal,
  bg,
  options,
  value,
  onChange,
}: ISelectProps) {
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
        <ChakraReactSelect
          // instanceId/inputId determinísticos evitam mismatch de hydration no SSR.
          instanceId={name}
          inputId={name}
          name={name}
          size={size}
          variant={variant}
          invalid={hasError}
          isDisabled={disabled}
          isSearchable={searchable}
          isClearable={clearable}
          autoFocus={autoFocus}
          menuPlacement={menuPlacement}
          placeholder={placeholder}
          options={options}
          value={options.find((option) => option.value === value) ?? null}
          onChange={(option) => onChange(option?.value ?? null)}
          selectedOptionColorPalette="teal"
          tagColorPalette="teal"
          noOptionsMessage={() => 'Nenhum registro encontrado'}
          {...(bg && { chakraStyles: { control: (provided) => ({ ...provided, bg }) } })}
          {...(usePortal &&
            typeof document !== 'undefined' && {
              menuPortalTarget: document.body,
              styles: { menuPortal: (provided) => ({ ...provided, zIndex: 1500 }) },
            })}
        />
      )}

      {hasError && <Field.ErrorText mt="1">{error}</Field.ErrorText>}
    </Field.Root>
  );
}
