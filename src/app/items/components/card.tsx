'use client';

import {
  Box,
  Flex,
  Heading,
  HStack,
  Input,
  NativeSelect,
  SegmentGroup,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useDebounce } from '@julianobazzi/nextjs-utils';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { LuPencil, LuPlus, LuSparkles, LuTrash2 } from 'react-icons/lu';
import {
  CategorizeModal,
  type CategorizeModalHandle,
} from '~/app/items/components/categorize-modal';
import { ItemModal, type ItemModalHandle } from '~/app/items/components/modal';
import { StatusBadge } from '~/components/Badge/StatusBadge';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import { ActionIconButton } from '~/components/Button/IconButton';
import { ConfirmDialog, type ConfirmDialogHandle } from '~/components/Form/ConfirmDialog';
import { type CustomColumnDef, TableWithService } from '~/components/Form/TableWithService';
import { API_URL_ITEMS, TABLE_ITEMS } from '~/config/constants';
import { useFeedback } from '~/contexts/FeedbackContext';
import type IItemAPI from '~/models/Entity/Item/IItemAPI';
import { OrderByTypeEnum } from '~/models/Request/Base/IParamsRequest';
import { api } from '~/services/apiClient';
import { useCategories } from '~/services/hooks/useCategories';
import { useItems } from '~/services/hooks/useItems';
import { queryClient } from '~/services/queryClient';

const TYPE_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'product', label: 'Produtos' },
  { value: 'service', label: 'Serviços' },
];

interface ItemsCardProps {
  aiEnabled: boolean;
}

export function ItemsCard({ aiEnabled }: ItemsCardProps) {
  const modalRef = useRef<ItemModalHandle>(null);
  const confirmRef = useRef<ConfirmDialogHandle>(null);
  const categorizeModalRef = useRef<CategorizeModalHandle>(null);
  const { successFeedbackToast, errorFeedbackToast } = useFeedback();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [typeFilter, setTypeFilter] = useState('');
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');

  const categoriesQuery = useCategories({
    perPage: 100,
    orderBy: 'name',
    sortedBy: OrderByTypeEnum.Asc,
  });
  const itemsQuery = useItems({ perPage: 100 });
  const categories = categoriesQuery.data?.data ?? [];
  const allItems = itemsQuery.data?.data ?? [];

  const setCategoryMutation = useMutation({
    mutationFn: ({ id, categoryId }: { id: string; categoryId: string | null }) =>
      api.patch(`${API_URL_ITEMS}/${id}`, { category_id: categoryId }),
    async onSuccess() {
      successFeedbackToast('Item', 'Categoria atualizada.');
      await queryClient.invalidateQueries({ queryKey: [TABLE_ITEMS] });
    },
    onError(error: Error) {
      errorFeedbackToast('Item', error);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`${API_URL_ITEMS}/${id}`),
    async onSuccess() {
      successFeedbackToast('Item', 'Excluído com sucesso!');
      await queryClient.invalidateQueries({ queryKey: [TABLE_ITEMS] });
    },
    onError(error: Error) {
      errorFeedbackToast('Item', error);
    },
  });

  const mergeMutation = useMutation({
    mutationFn: () => api.post('/api/items/merge', { sourceId: source, targetId: target }),
    async onSuccess() {
      successFeedbackToast('Itens', 'Mesclados com sucesso!');
      setSource('');
      setTarget('');
      await queryClient.invalidateQueries({ queryKey: [TABLE_ITEMS] });
    },
    onError(error: Error) {
      errorFeedbackToast('Itens', error);
    },
  });

  const uncategorizedCount = allItems.filter((i) => !i.category_id).length;

  const columns = useMemo<CustomColumnDef<IItemAPI>[]>(
    () => [
      {
        accessorKey: 'reference_code',
        header: 'Código',
        cell: (info) => (
          <Text fontVariantNumeric="tabular-nums" color="fg.muted">
            {info.getValue<string>()}
          </Text>
        ),
      },
      {
        accessorKey: 'name',
        header: 'Nome',
        cell: ({ row }) => <Text fontWeight="medium">{row.original.name}</Text>,
      },
      {
        accessorKey: 'type',
        header: 'Tipo',
        cell: ({ row }) => (
          <StatusBadge
            withDot={false}
            label={row.original.type === 'product' ? 'Produto' : 'Serviço'}
            colorPalette={row.original.type === 'product' ? 'blue' : 'purple'}
          />
        ),
      },
      {
        id: 'category',
        header: 'Categoria',
        enableSorting: false,
        cell: ({ row }) => (
          <NativeSelect.Root size="sm" maxW="48">
            <NativeSelect.Field
              value={row.original.category_id ?? ''}
              onChange={(e) =>
                setCategoryMutation.mutate({
                  id: row.original.id,
                  categoryId: e.target.value || null,
                })
              }
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
            <ActionIconButton
              aria-label="Excluir"
              colorPalette="red"
              onClick={() =>
                confirmRef.current?.open({
                  title: 'Excluir item?',
                  description: `Tem certeza que deseja excluir "${row.original.name}"? Ele será removido da listagem (as notas já importadas continuam intactas).`,
                  onConfirm: async () => {
                    await removeMutation.mutateAsync(row.original.id);
                  },
                })
              }
            >
              <LuTrash2 />
            </ActionIconButton>
          </HStack>
        ),
      },
    ],
    [categories, setCategoryMutation, removeMutation],
  );

  return (
    <Stack gap="5">
      <Flex justify="space-between" align="center" gap="4" wrap="wrap">
        <Stack gap="0.5">
          <Heading size="lg" fontFamily="heading">
            Itens
          </Heading>
          <Text fontSize="sm" color="fg.muted">
            Produtos e serviços identificados nas suas notas.
          </Text>
        </Stack>
        <HStack gap="2">
          {aiEnabled && (
            <PrimaryButton
              size="sm"
              disabled={uncategorizedCount === 0}
              onClick={() => categorizeModalRef.current?.open()}
            >
              <LuSparkles /> Categorizar com IA
              {uncategorizedCount > 0 ? ` (${uncategorizedCount})` : ''}
            </PrimaryButton>
          )}
          <PrimaryButton size="sm" onClick={() => modalRef.current?.onOpenDialog()}>
            <LuPlus /> Novo item
          </PrimaryButton>
        </HStack>
      </Flex>

      <Flex justify="space-between" align="center" gap="3" wrap="wrap">
        <SegmentGroup.Root
          size="sm"
          value={typeFilter}
          onValueChange={(e) => setTypeFilter(e.value ?? '')}
        >
          <SegmentGroup.Indicator />
          {TYPE_FILTERS.map((t) => (
            <SegmentGroup.Item key={t.value} value={t.value}>
              <SegmentGroup.ItemText>{t.label}</SegmentGroup.ItemText>
              <SegmentGroup.ItemHiddenInput />
            </SegmentGroup.Item>
          ))}
        </SegmentGroup.Root>

        <Input
          size="sm"
          maxW="sm"
          bg="bg.surface"
          placeholder="Buscar item..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Flex>

      <TableWithService
        columns={columns}
        parameters={{ search: debouncedSearch, type: typeFilter || undefined }}
        onSearch={useItems}
        orderBy={{ id: 'name', desc: false }}
      />

      <Box borderWidth="1px" borderRadius="lg" p="4" bg="bg.surface">
        <Text fontWeight="semibold" mb="1" fontSize="sm">
          Mesclar itens duplicados
        </Text>
        <Text fontSize="xs" color="fg.muted" mb="3">
          Reaponta o histórico de um item para outro e remove o duplicado.
        </Text>
        <HStack gap="2" wrap="wrap" align="end">
          <NativeSelect.Root size="sm" maxW="64">
            <NativeSelect.Field value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">Item de origem (será removido)</option>
              {allItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
          <NativeSelect.Root size="sm" maxW="64">
            <NativeSelect.Field value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Item de destino (será mantido)</option>
              {allItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
          <PrimaryButton
            size="sm"
            loading={mergeMutation.isPending}
            onClick={() => {
              if (!source || !target || source === target) {
                errorFeedbackToast('Itens', 'Selecione dois itens diferentes.');
                return;
              }
              mergeMutation.mutate();
            }}
          >
            Mesclar
          </PrimaryButton>
        </HStack>
      </Box>

      <ItemModal ref={modalRef} />
      <ConfirmDialog ref={confirmRef} />
      <CategorizeModal ref={categorizeModalRef} />
    </Stack>
  );
}
