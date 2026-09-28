'use client';

import { Box, Dialog, Flex, HStack, IconButton, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { useBeforeUnload } from '@julianobazzi/nextjs-utils';
import { revalidateLogic, useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { useSelector } from '@tanstack/react-store';
import { type Ref, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import { SecondaryButton } from '~/components/Button/Base/SecondaryButton';
import { CATEGORY_ICONS, CategoryIcon } from '~/components/CategoryIcon';
import { Modal, type ModalHandle } from '~/components/Form/Modal';
import { Input } from '~/components/Input';
import { Toggle } from '~/components/Toggle/Switch';
import { API_URL_CATEGORIES, TABLE_CATEGORIES } from '~/config/constants';
import { useFeedback } from '~/contexts/FeedbackContext';
import {
  CATEGORY_COLORS,
  type CategoryIconKey,
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
  isCategoryColor,
  isCategoryIconKey,
} from '~/lib/category-icons';
import type ICategoryAPI from '~/models/Entity/Category/ICategoryAPI';
import { type CategoryData, categorySchema } from '~/schemas/category';
import { api } from '~/services/apiClient';
import { queryClient } from '~/services/queryClient';

export type CategoryModalHandle = {
  onOpenDialog: (category?: ICategoryAPI) => void;
};

const ICON_KEYS = Object.keys(CATEGORY_ICONS) as CategoryIconKey[];

/** Valores do form a partir da categoria em edição (ou os defaults do cadastro). */
function formValues(category?: ICategoryAPI): CategoryData {
  return {
    name: category?.name ?? '',
    active: category?.active ?? true,
    icon: isCategoryIconKey(category?.icon) ? category.icon : DEFAULT_CATEGORY_ICON,
    color: isCategoryColor(category?.color) ? category.color : DEFAULT_CATEGORY_COLOR,
  };
}

export function CategoryModal({ ref }: { ref?: Ref<CategoryModalHandle> }) {
  const modalRef = useRef<ModalHandle>(null);
  const { successFeedbackToast, errorFeedbackToast } = useFeedback();
  const [editing, setEditing] = useState<ICategoryAPI | undefined>();
  const [open, setOpen] = useState(false);

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

  const defaultValues = useMemo<CategoryData>(() => formValues(editing), [editing]);

  const form = useForm({
    defaultValues,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: categorySchema },
    onSubmit: ({ value }) => mutation.mutateAsync(categorySchema.parse(value)),
  });

  const isSubmitting = useSelector(form.store, (state) => state.isSubmitting);
  const isDirty = useSelector(form.store, (state) => state.isDirty);
  // Assinados à parte para o preview refletir os dois campos ao mesmo tempo.
  const selectedIcon = useSelector(form.store, (state) => state.values.icon);
  const selectedColor = useSelector(form.store, (state) => state.values.color);

  useBeforeUnload(open && isDirty, 'Você tem alterações não salvas. Deseja mesmo sair?');

  useImperativeHandle(
    ref,
    () => ({
      onOpenDialog(category?: ICategoryAPI) {
        setEditing(category);
        form.reset(formValues(category));
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
      onOpenChange={setOpen}
      busy={isSubmitting}
    >
      <Dialog.Body>
        <Stack gap="4">
          <form.Field name="name">
            {(field) => (
              <Input
                name={field.name}
                label="Nome da categoria"
                placeholder="Ex.: Supermercado"
                required
                disabled={isSubmitting}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]?.message}
              />
            )}
          </form.Field>

          <Stack gap="2">
            <HStack gap="2.5">
              <CategoryIcon icon={selectedIcon} color={selectedColor} size="10" iconSize={18} />
              <Stack gap="0">
                <Text fontSize="sm" fontWeight="semibold">
                  Ícone
                </Text>
                <Text fontSize="xs" color="fg.muted">
                  Aparece nas listagens e no resumo por categoria.
                </Text>
              </Stack>
            </HStack>
            <form.Field name="icon">
              {(field) => (
                <SimpleGrid columns={{ base: 7, sm: 9 }} gap="1.5">
                  {ICON_KEYS.map((key) => {
                    const Icon = CATEGORY_ICONS[key];
                    const selected = field.state.value === key;
                    return (
                      <IconButton
                        key={key}
                        type="button"
                        variant="plain"
                        rounded="full"
                        boxSize="9"
                        aria-label={key}
                        aria-pressed={selected}
                        disabled={isSubmitting}
                        colorPalette={selectedColor ?? DEFAULT_CATEGORY_COLOR}
                        bg={selected ? 'colorPalette.subtle' : 'bg.subtle'}
                        color={selected ? 'colorPalette.fg' : 'fg.muted'}
                        borderWidth="1px"
                        borderColor={selected ? 'colorPalette.fg' : 'transparent'}
                        _hover={{ borderColor: 'border.emphasized' }}
                        onClick={() => field.handleChange(key)}
                      >
                        <Icon size={16} />
                      </IconButton>
                    );
                  })}
                </SimpleGrid>
              )}
            </form.Field>
          </Stack>

          <Stack gap="2">
            <Text fontSize="sm" fontWeight="semibold">
              Cor
            </Text>
            <form.Field name="color">
              {(field) => (
                <HStack gap="1.5" wrap="wrap">
                  {CATEGORY_COLORS.map((color) => {
                    const selected = field.state.value === color;
                    return (
                      <IconButton
                        key={color}
                        type="button"
                        variant="plain"
                        rounded="full"
                        boxSize="7"
                        minW="7"
                        aria-label={color}
                        aria-pressed={selected}
                        disabled={isSubmitting}
                        colorPalette={color}
                        bg="colorPalette.solid"
                        outline={selected ? '2px solid' : 'none'}
                        outlineColor="colorPalette.fg"
                        outlineOffset="2px"
                        onClick={() => field.handleChange(color)}
                      />
                    );
                  })}
                </HStack>
              )}
            </form.Field>
          </Stack>

          <form.Field name="active">
            {(field) => (
              <Flex
                justify="space-between"
                align="center"
                gap="4"
                borderWidth="1px"
                borderRadius="lg"
                p="3"
              >
                <Box>
                  <Text fontSize="sm" fontWeight="semibold">
                    Categoria ativa
                  </Text>
                  <Text fontSize="xs" color="fg.muted">
                    Itens de categorias inativas não entram no cálculo da inflação.
                  </Text>
                </Box>
                <Toggle
                  checked={field.state.value}
                  onChange={(v) => field.handleChange(v)}
                  disabled={isSubmitting}
                />
              </Flex>
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
          Salvar categoria
        </PrimaryButton>
      </Dialog.Footer>
    </Modal>
  );
}
