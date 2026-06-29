'use client';

import { Flex, Heading, HStack, IconButton, Input, Stack } from '@chakra-ui/react';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { LuPencil, LuPlus, LuTrash2 } from 'react-icons/lu';
import { CategoryModal, type CategoryModalHandle } from '~/app/categories/components/modal';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import { type CustomColumnDef, TableWithService } from '~/components/Form/TableWithService';
import { API_URL_CATEGORIES, TABLE_CATEGORIES } from '~/config/constants';
import { useFeedback } from '~/contexts/FeedbackContext';
import type ICategoryAPI from '~/models/Entity/Category/ICategoryAPI';
import { api } from '~/services/apiClient';
import { useCategories } from '~/services/hooks/useCategories';
import { queryClient } from '~/services/queryClient';

export function CategoriesCard() {
  const modalRef = useRef<CategoryModalHandle>(null);
  const { successFeedbackToast, errorFeedbackToast } = useFeedback();
  const [search, setSearch] = useState('');

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`${API_URL_CATEGORIES}/${id}`),
    async onSuccess() {
      successFeedbackToast('Categoria', 'Excluída com sucesso!');
      await queryClient.invalidateQueries({ queryKey: [TABLE_CATEGORIES] });
    },
    onError(error: Error) {
      errorFeedbackToast('Categoria', error);
    },
  });

  const columns = useMemo<CustomColumnDef<ICategoryAPI>[]>(
    () => [
      { accessorKey: 'name', header: 'Categoria', cell: (info) => info.getValue<string>() },
      { accessorKey: 'slug', header: 'Slug', cell: (info) => info.getValue<string>() },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <HStack gap="1" justify="end">
            <IconButton
              size="xs"
              variant="ghost"
              aria-label="Editar"
              onClick={() => modalRef.current?.onOpenDialog(row.original)}
            >
              <LuPencil />
            </IconButton>
            <IconButton
              size="xs"
              variant="ghost"
              colorPalette="red"
              aria-label="Excluir"
              onClick={() => {
                if (window.confirm(`Excluir a categoria "${row.original.name}"?`)) {
                  removeMutation.mutate(row.original.id);
                }
              }}
            >
              <LuTrash2 />
            </IconButton>
          </HStack>
        ),
      },
    ],
    [removeMutation],
  );

  return (
    <Stack gap="4">
      <Flex justify="space-between" align="center" gap="4" wrap="wrap">
        <Heading size="lg">Categorias</Heading>
        <PrimaryButton size="sm" onClick={() => modalRef.current?.onOpenDialog()}>
          <LuPlus /> Nova categoria
        </PrimaryButton>
      </Flex>

      <Input
        size="sm"
        maxW="sm"
        placeholder="Buscar categoria..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <TableWithService
        columns={columns}
        parameters={{ search }}
        onSearch={useCategories}
        orderBy={{ id: 'name', desc: false }}
      />

      <CategoryModal ref={modalRef} />
    </Stack>
  );
}
