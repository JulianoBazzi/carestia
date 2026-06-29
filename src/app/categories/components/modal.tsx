'use client';

import { Dialog, Stack } from '@chakra-ui/react';
import { revalidateLogic, useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { useSelector } from '@tanstack/react-store';
import { type Ref, useImperativeHandle, useRef, useState } from 'react';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import { SecondaryButton } from '~/components/Button/Base/SecondaryButton';
import { Modal, type ModalHandle } from '~/components/Form/Modal';
import { Input } from '~/components/Input';
import { API_URL_CATEGORIES, TABLE_CATEGORIES } from '~/config/constants';
import { useFeedback } from '~/contexts/FeedbackContext';
import type ICategoryAPI from '~/models/Entity/Category/ICategoryAPI';
import { type CategoryData, categorySchema } from '~/schemas/category';
import { api } from '~/services/apiClient';
import { queryClient } from '~/services/queryClient';

export type CategoryModalHandle = {
  onOpenDialog: (category?: ICategoryAPI) => void;
};

export function CategoryModal({ ref }: { ref?: Ref<CategoryModalHandle> }) {
  const modalRef = useRef<ModalHandle>(null);
  const { successFeedbackToast, errorFeedbackToast } = useFeedback();
  const [editing, setEditing] = useState<ICategoryAPI | undefined>();

  const isEditing = !!editing;

  const mutation = useMutation({
    mutationFn: async (data: CategoryData) => {
      if (editing) {
        const response = await api.patch(`${API_URL_CATEGORIES}/${editing.id}`, data);
        return response.data;
      }
      const response = await api.post(API_URL_CATEGORIES, data);
      return response.data;
    },
    async onSuccess() {
      successFeedbackToast('Categoria', `${isEditing ? 'Atualizada' : 'Cadastrada'} com sucesso!`);
      await queryClient.invalidateQueries({ queryKey: [TABLE_CATEGORIES] });
      modalRef.current?.onCloseDialog();
    },
    onError(error: Error) {
      errorFeedbackToast('Categoria', error);
    },
  });

  const form = useForm({
    defaultValues: { name: '' } as CategoryData,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: categorySchema },
    onSubmit: ({ value }) => mutation.mutateAsync(categorySchema.parse(value)),
  });

  const isSubmitting = useSelector(form.store, (state) => state.isSubmitting);

  useImperativeHandle(
    ref,
    () => ({
      onOpenDialog(category?: ICategoryAPI) {
        setEditing(category);
        form.reset({ name: category?.name ?? '' });
        modalRef.current?.onOpenDialog();
      },
    }),
    [form],
  );

  return (
    <Modal
      ref={modalRef}
      title={isEditing ? 'Editar categoria' : 'Nova categoria'}
      onSubmit={() => form.handleSubmit()}
    >
      <Dialog.Body>
        <Stack gap="4">
          <form.Field name="name">
            {(field) => (
              <Input
                name={field.name}
                label="Nome"
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]?.message}
              />
            )}
          </form.Field>
        </Stack>
      </Dialog.Body>
      <Dialog.Footer gap="2">
        <SecondaryButton type="button" onClick={() => modalRef.current?.onCloseDialog()}>
          Cancelar
        </SecondaryButton>
        <PrimaryButton type="submit" loading={isSubmitting}>
          Salvar
        </PrimaryButton>
      </Dialog.Footer>
    </Modal>
  );
}
