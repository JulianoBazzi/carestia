'use client';

import { Flex, Heading, HStack, Input, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { useDebounce } from '@julianobazzi/nextjs-utils';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import {
  LuCircleCheck,
  LuCircleSlash,
  LuFolderTree,
  LuPencil,
  LuPlus,
  LuTrash2,
} from 'react-icons/lu';
import { CategoryModal, type CategoryModalHandle } from '~/app/categories/components/modal';
import { StatusBadge } from '~/components/Badge/StatusBadge';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import { ActionIconButton } from '~/components/Button/IconButton';
import { CategoryIcon } from '~/components/CategoryIcon';
import { ConfirmDialog, type ConfirmDialogHandle } from '~/components/Form/ConfirmDialog';
import { type CustomColumnDef, TableWithService } from '~/components/Form/TableWithService';
import { StatCard } from '~/components/StatCard';
import { API_URL_CATEGORIES, TABLE_CATEGORIES } from '~/config/constants';
import { useFeedback } from '~/contexts/FeedbackContext';
import type ICategoryAPI from '~/models/Entity/Category/ICategoryAPI';
import { api } from '~/services/apiClient';
import { useCategories } from '~/services/hooks/useCategories';
import { queryClient } from '~/services/queryClient';

interface ICategoriesSummary {
  total: number;
  active: number;
  inactive: number;
}

interface CategoriesCardProps {
  canManage: boolean;
}

export function CategoriesCard({ canManage }: CategoriesCardProps) {
  const modalRef = useRef<CategoryModalHandle>(null);
  const confirmRef = useRef<ConfirmDialogHandle>(null);
  const { successFeedbackToast, errorFeedbackToast } = useFeedback();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);

  const { data: summary } = useQuery({
    queryKey: [TABLE_CATEGORIES, 'summary'],
    queryFn: async () => {
      const { data } = await api.get(API_URL_CATEGORIES, { params: { limit: 1 } });
      return data.summary as ICategoriesSummary;
    },
    refetchOnWindowFocus: true,
  });

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
      {
        accessorKey: 'name',
        header: 'Categoria',
        cell: ({ row }) => (
          <HStack gap="2.5">
            <CategoryIcon icon={row.original.icon} color={row.original.color} />
            <Text fontWeight="medium">{row.original.name}</Text>
          </HStack>
        ),
      },
      {
        accessorKey: 'items_count',
        header: 'Itens vinculados',
        cell: (info) =>
          `${info.getValue<number>() ?? 0} ${info.getValue<number>() === 1 ? 'item' : 'itens'}`,
      },
      {
        accessorKey: 'active',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.active ? (
            <StatusBadge label="Ativo" colorPalette="teal" />
          ) : (
            <StatusBadge label="Inativo" colorPalette="gray" />
          ),
      },
      {
        id: 'actions',
        header: 'Ações',
        enableSorting: false,
        cell: ({ row }) => (
          <HStack gap="1.5" justify="end">
            <ActionIconButton
              aria-label="Editar"
              onClick={() => modalRef.current?.onOpenDialog(row.original)}
            >
              <LuPencil />
            </ActionIconButton>
            {canManage && (
              <ActionIconButton
                aria-label="Excluir"
                colorPalette="red"
                onClick={() =>
                  confirmRef.current?.open({
                    title: 'Excluir categoria?',
                    description: `Tem certeza que deseja excluir a categoria "${row.original.name}"? Os ${row.original.items_count ?? 0} itens vinculados ficarão sem categoria.`,
                    onConfirm: async () => {
                      await removeMutation.mutateAsync(row.original.id);
                    },
                  })
                }
              >
                <LuTrash2 />
              </ActionIconButton>
            )}
          </HStack>
        ),
      },
    ],
    [removeMutation, canManage],
  );

  return (
    <Stack gap="5">
      <Flex justify="space-between" align="center" gap="4" wrap="wrap">
        <Stack gap="0.5">
          <Heading size="lg" fontFamily="heading">
            Categorias
          </Heading>
          <Text fontSize="sm" color="fg.muted">
            Organize seus itens e acompanhe a inflação por grupo.
          </Text>
        </Stack>
        <PrimaryButton size="sm" onClick={() => modalRef.current?.onOpenDialog()}>
          <LuPlus /> Nova categoria
        </PrimaryButton>
      </Flex>

      <SimpleGrid columns={{ base: 1, sm: 3 }} gap="4">
        <StatCard
          label="Total de categorias"
          value={summary?.total ?? 0}
          icon={<LuFolderTree size={18} />}
          colorPalette="teal"
        />
        <StatCard
          label="Ativas"
          value={summary?.active ?? 0}
          icon={<LuCircleCheck size={18} />}
          colorPalette="teal"
        />
        <StatCard
          label="Inativas"
          value={summary?.inactive ?? 0}
          icon={<LuCircleSlash size={18} />}
          colorPalette="gray"
        />
      </SimpleGrid>

      <Input
        size="sm"
        maxW="sm"
        bg="bg.surface"
        placeholder="Buscar categoria..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <TableWithService
        columns={columns}
        parameters={{ search: debouncedSearch }}
        onSearch={useCategories}
        orderBy={{ id: 'name', desc: false }}
      />

      <CategoryModal ref={modalRef} />
      <ConfirmDialog ref={confirmRef} />
    </Stack>
  );
}
