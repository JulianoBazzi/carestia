'use client';

import { Field, HStack, IconButton, Skeleton } from '@chakra-ui/react';
import { getProperty } from '@julianobazzi/utils';
import { AsyncSelect } from 'chakra-react-select';
import { useRef } from 'react';
import { LuPlus } from 'react-icons/lu';
import type IEntityBase from '~/models/Entity/Base/IEntityBase';
import type IParamsRequest from '~/models/Request/Base/IParamsRequest';
import { OrderByTypeEnum } from '~/models/Request/Base/IParamsRequest';
import type IListResponse from '~/models/Response/IListResponse';

const SEARCH_DEBOUNCE_MS = 400;
const PAGE_SIZE = 50;

export interface ISelectWithServiceProps<T extends IEntityBase> {
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
  clearable?: boolean;
  autoFocus?: boolean;
  /** Ver comentário em `Select`: portal só fora de dialogs. */
  usePortal?: boolean;
  /** Fundo do controle (ex.: 'bg.surface' em barras de filtro). */
  bg?: string;
  /** Campo usado como valor da opção. Default 'id'. */
  optionValue?: keyof T;
  /** Campo (ou função) usado como rótulo. Default 'name'. */
  optionLabel?: keyof T | ((option: T) => string);
  /** Campo de ordenação enviado à API. Default: `optionLabel` quando for string. */
  orderBy?: string;
  /** Filtros extras enviados em toda busca. Passe um objeto estável/memoizado. */
  parameters?: Partial<IParamsRequest>;
  /** Mudou → remonta o select e recarrega as opções iniciais. */
  reloadTrigger?: unknown;
  /** Renderiza um botão "+" ao lado do label (ex.: cadastrar novo registro). */
  onAdd?: () => void;
  onSearch: (params?: IParamsRequest) => Promise<IListResponse<T>>;
  value?: T | null;
  onChange: (option: T | null) => void;
}

/**
 * Select assíncrono sobre chakra-react-select: busca as opções no servidor
 * (com debounce) conforme o usuário digita, via um fetcher `onSearch` que
 * retorna `IListResponse` (ex.: `getItems`, `getCompanies`). O valor é o
 * objeto da entidade — um select assíncrono não resolve id→rótulo sozinho.
 */
export function SelectWithService<T extends IEntityBase>({
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
  clearable,
  autoFocus,
  usePortal,
  bg,
  optionValue = 'id',
  optionLabel = 'name' as keyof T,
  orderBy,
  parameters,
  reloadTrigger,
  onAdd,
  onSearch,
  value,
  onChange,
}: ISelectWithServiceProps<T>) {
  const hasError = !!error;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getLabel = (option: T) =>
    typeof optionLabel === 'function'
      ? optionLabel(option)
      : String(getProperty(option, optionLabel as never) ?? '');
  const getValue = (option: T) => String(getProperty(option, optionValue as never) ?? '');

  const fetchOptions = async (inputValue: string) => {
    try {
      const response = await onSearch({
        ...parameters,
        // A API busca por substring simples — sem sintaxe 'campo:valor'.
        search: inputValue || null,
        orderBy: orderBy ?? (typeof optionLabel === 'string' ? String(optionLabel) : 'name'),
        sortedBy: OrderByTypeEnum.Asc,
        page: 1,
        perPage: PAGE_SIZE,
      });
      return response.data;
    } catch {
      return [];
    }
  };

  // Debounce por timer: promises antigas ficam pendentes, mas o AsyncSelect só
  // aplica a resolução da última chamada — sem corrida de resultados.
  const loadOptions = (inputValue: string) =>
    new Promise<T[]>((resolve) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(
        () => resolve(fetchOptions(inputValue)),
        inputValue ? SEARCH_DEBOUNCE_MS : 0,
      );
    });

  return (
    <Field.Root invalid={hasError} required={required} maxW={maxW}>
      {!!label && (
        <HStack gap="1" align="center">
          <Field.Label htmlFor={name}>
            {label}
            {required && <Field.RequiredIndicator />}
          </Field.Label>
          {onAdd && (
            <IconButton
              size="2xs"
              variant="ghost"
              colorPalette="teal"
              aria-label="Adicionar"
              onClick={onAdd}
            >
              <LuPlus />
            </IconButton>
          )}
        </HStack>
      )}

      {loading ? (
        <Skeleton height="10" w="100%" borderRadius="md" />
      ) : (
        <AsyncSelect
          // Remonta quando filtros/trigger mudam, recarregando as defaultOptions.
          key={`${name}-${JSON.stringify(parameters ?? {})}-${String(reloadTrigger ?? '')}`}
          instanceId={name}
          inputId={name}
          name={name}
          size={size}
          variant={variant}
          invalid={hasError}
          isDisabled={disabled}
          isClearable={clearable}
          autoFocus={autoFocus}
          menuPlacement={menuPlacement}
          placeholder={placeholder}
          defaultOptions
          loadOptions={loadOptions}
          getOptionLabel={getLabel}
          getOptionValue={getValue}
          value={value ?? null}
          onChange={(option) => onChange(option ?? null)}
          selectedOptionColorPalette="teal"
          tagColorPalette="teal"
          noOptionsMessage={() => 'Nenhum registro encontrado'}
          loadingMessage={() => 'Buscando…'}
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
