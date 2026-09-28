'use client';

import { Dialog, Stack } from '@chakra-ui/react';
import { useBeforeUnload } from '@julianobazzi/nextjs-utils';
import { revalidateLogic, useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { useSelector } from '@tanstack/react-store';
import { type Ref, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import { SecondaryButton } from '~/components/Button/Base/SecondaryButton';
import { formatCategoryOption, toCategoryOptions } from '~/components/Form/CategorySelectOption';
import { Modal, type ModalHandle } from '~/components/Form/Modal';
import { Select } from '~/components/Form/Select';
import { Input } from '~/components/Input';
import { API_URL_ITEMS, TABLE_ITEMS } from '~/config/constants';
import { useFeedback } from '~/contexts/FeedbackContext';
import type IItemAPI from '~/models/Entity/Item/IItemAPI';
import { OrderByTypeEnum } from '~/models/Request/Base/IParamsRequest';
import { type ItemData, type ItemFormInput, itemSchema } from '~/schemas/item';
import { api } from '~/services/apiClient';
import { useCategories } from '~/services/hooks/useCategories';
import { queryClient } from '~/services/queryClient';

export type ItemModalHandle = {
  onOpenDialog: (item?: IItemAPI) => void;
};

// `type` é fixo em 'product' (sem campo na UI, e a API trava o valor): neste
// momento o cadastro manual só cria produtos. Editar um item não altera o tipo.
const EMPTY: ItemFormInput = {
  type: 'product',
  name: '',
  reference_code: '',
  ean: '',
  category_id: '',
  unit: '',
};

export function ItemModal({
  ref,
  canEditEan,
}: {
  ref?: Ref<ItemModalHandle>;
  /** EAN é só-admin: o servidor ignora o campo para os demais usuários. */
  canEditEan: boolean;
}) {
  const modalRef = useRef<ModalHandle>(null);
  const { successFeedbackToast, errorFeedbackToast } = useFeedback();
  const [editing, setEditing] = useState<IItemAPI | undefined>();
  const [open, setOpen] = useState(false);

  const isEditing = !!editing;
  const categoriesQuery = useCategories({
    perPage: 100,
    orderBy: 'name',
    sortedBy: OrderByTypeEnum.Asc,
  });
  const categories = categoriesQuery.data?.data ?? [];
  const categoryOptions = useMemo(() => toCategoryOptions(categories), [categories]);

  const mutation = useMutation({
    mutationFn: async (data: ItemData) => {
      if (editing) {
        const response = await api.patch(`${API_URL_ITEMS}/${editing.id}`, data);
        return response.data;
      }
      const response = await api.post(API_URL_ITEMS, data);
      return response.data;
    },
    async onSuccess() {
      successFeedbackToast('Item', `${isEditing ? 'Atualizado' : 'Cadastrado'} com sucesso!`);
      await queryClient.invalidateQueries({ queryKey: [TABLE_ITEMS] });
      modalRef.current?.onCloseDialog();
    },
    onError(error: Error) {
      errorFeedbackToast('Item', error);
    },
  });

  const defaultValues = useMemo<ItemFormInput>(
    () =>
      editing
        ? {
            type: 'product',
            name: editing.name,
            reference_code: editing.reference_code,
            ean: editing.ean ?? '',
            category_id: editing.category_id ?? '',
            unit: editing.unit ?? '',
          }
        : EMPTY,
    [editing],
  );

  const form = useForm({
    defaultValues,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: itemSchema },
    onSubmit: ({ value }) => mutation.mutateAsync(itemSchema.parse(value)),
  });

  const isSubmitting = useSelector(form.store, (state) => state.isSubmitting);
  const isDirty = useSelector(form.store, (state) => state.isDirty);

  useBeforeUnload(open && isDirty, 'Você tem alterações não salvas. Deseja mesmo sair?');

  useImperativeHandle(
    ref,
    () => ({
      onOpenDialog(item?: IItemAPI) {
        setEditing(item);
        form.reset(
          item
            ? {
                type: 'product',
                name: item.name,
                reference_code: item.reference_code,
                ean: item.ean ?? '',
                category_id: item.category_id ?? '',
                unit: item.unit ?? '',
              }
            : EMPTY,
        );
        modalRef.current?.onOpenDialog();
      },
    }),
    [form],
  );

  return (
    <Modal
      ref={modalRef}
      title={isEditing ? 'Editar item' : 'Novo item'}
      onSubmit={() => form.handleSubmit()}
      onOpenChange={setOpen}
      busy={isSubmitting}
    >
      <Dialog.Body>
        <Stack gap="4">
          <form.Field name="name">
            {(field) => (
              <Input
                name={field.name}
                label="Nome do item"
                placeholder="Ex.: Arroz branco tipo 1 - 5kg"
                required
                disabled={isSubmitting}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]?.message}
              />
            )}
          </form.Field>

          <form.Field name="reference_code">
            {(field) => (
              <Input
                name={field.name}
                label="Código NCM / referência"
                // Sem NCM na NFC-e (Infosimples): o campo fica opcional e pode
                // ser preenchido depois.
                placeholder="Ex.: 1006.30.21 (opcional)"
                disabled={isSubmitting}
                value={field.state.value ?? ''}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]?.message}
              />
            )}
          </form.Field>

          <form.Field name="ean">
            {(field) => (
              <Input
                name={field.name}
                label="Código de barras (EAN/GTIN)"
                placeholder="Ex.: 7891234567895 (opcional)"
                inputMode="numeric"
                maxLength={14}
                disabled={isSubmitting || !canEditEan}
                value={field.state.value ?? ''}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]?.message}
              />
            )}
          </form.Field>

          <form.Field name="category_id">
            {(field) => (
              <Select
                name={field.name}
                label="Categoria"
                placeholder="Sem categoria"
                clearable
                disabled={isSubmitting}
                loading={categoriesQuery.isLoading}
                options={categoryOptions}
                formatOptionLabel={formatCategoryOption}
                value={field.state.value ?? ''}
                onChange={(v) => field.handleChange(v ?? '')}
                error={field.state.meta.errors[0]?.message}
              />
            )}
          </form.Field>

          <form.Field name="unit">
            {(field) => (
              <Input
                name={field.name}
                label="Unidade"
                placeholder="Ex.: UN, kg, kWh, L"
                disabled={isSubmitting}
                value={field.state.value ?? ''}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]?.message}
              />
            )}
          </form.Field>
        </Stack>
      </Dialog.Body>
      <Dialog.Footer gap="2">
        <SecondaryButton
          type="button"
          disabled={isSubmitting}
          onClick={() => modalRef.current?.onCloseDialog()}
        >
          Cancelar
        </SecondaryButton>
        <PrimaryButton type="submit" loading={isSubmitting}>
          Salvar item
        </PrimaryButton>
      </Dialog.Footer>
    </Modal>
  );
}
