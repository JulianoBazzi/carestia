'use client';

import { Dialog, Field, NativeSelect, SegmentGroup, Stack } from '@chakra-ui/react';
import { useBeforeUnload } from '@julianobazzi/nextjs-utils';
import { revalidateLogic, useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { useSelector } from '@tanstack/react-store';
import { type Ref, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import { SecondaryButton } from '~/components/Button/Base/SecondaryButton';
import { Modal, type ModalHandle } from '~/components/Form/Modal';
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

const EMPTY: ItemFormInput = {
  type: 'product',
  name: '',
  reference_code: '',
  category_id: '',
  unit: '',
};

export function ItemModal({ ref }: { ref?: Ref<ItemModalHandle> }) {
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
            type: editing.type,
            name: editing.name,
            reference_code: editing.reference_code,
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
                type: item.type,
                name: item.name,
                reference_code: item.reference_code,
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
          <form.Field name="type">
            {(field) => (
              <Field.Root>
                <Field.Label>Tipo</Field.Label>
                <SegmentGroup.Root
                  value={field.state.value}
                  onValueChange={(e) =>
                    field.handleChange((e.value as 'product' | 'service') ?? 'product')
                  }
                  disabled={isSubmitting}
                  width="full"
                >
                  <SegmentGroup.Indicator />
                  <SegmentGroup.Item value="product" flex="1" justifyContent="center">
                    <SegmentGroup.ItemText>Produto</SegmentGroup.ItemText>
                    <SegmentGroup.ItemHiddenInput />
                  </SegmentGroup.Item>
                  <SegmentGroup.Item value="service" flex="1" justifyContent="center">
                    <SegmentGroup.ItemText>Serviço</SegmentGroup.ItemText>
                    <SegmentGroup.ItemHiddenInput />
                  </SegmentGroup.Item>
                </SegmentGroup.Root>
              </Field.Root>
            )}
          </form.Field>

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
                placeholder="Ex.: 1006.30.21"
                required
                disabled={isSubmitting}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]?.message}
              />
            )}
          </form.Field>

          <form.Field name="category_id">
            {(field) => (
              <Field.Root>
                <Field.Label>Categoria</Field.Label>
                <NativeSelect.Root disabled={isSubmitting}>
                  <NativeSelect.Field
                    value={field.state.value ?? ''}
                    onChange={(e) => field.handleChange(e.target.value)}
                  >
                    <option value="">Sem categoria</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Field.Root>
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
