'use client';

import {
  Badge,
  Box,
  Flex,
  Heading,
  HStack,
  Input,
  NativeSelect,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import { type CustomColumnDef, TableWithService } from '~/components/Form/TableWithService';
import { API_URL_ITEMS, TABLE_ITEMS } from '~/config/constants';
import { useFeedback } from '~/contexts/FeedbackContext';
import type IItemAPI from '~/models/Entity/Item/IItemAPI';
import { api } from '~/services/apiClient';
import { useCategories } from '~/services/hooks/useCategories';
import { useItems } from '~/services/hooks/useItems';
import { queryClient } from '~/services/queryClient';

export function ItemsCard() {
  const { successFeedbackToast, errorFeedbackToast } = useFeedback();
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');

  const categoriesQuery = useCategories({ perPage: 100, orderBy: 'name', sortedBy: undefined });
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

  const columns = useMemo<CustomColumnDef<IItemAPI>[]>(
    () => [
      { accessorKey: 'name', header: 'Item', cell: (info) => info.getValue<string>() },
      { accessorKey: 'reference_code', header: 'Ref', cell: (info) => info.getValue<string>() },
      {
        accessorKey: 'type',
        header: 'Tipo',
        cell: ({ row }) => (
          <Badge colorPalette={row.original.type === 'product' ? 'blue' : 'purple'}>
            {row.original.type === 'product' ? 'Produto' : 'Serviço'}
          </Badge>
        ),
      },
      {
        id: 'usage_count',
        header: 'Usos',
        enableSorting: false,
        cell: ({ row }) => <Text textAlign="end">{row.original.usage_count}</Text>,
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
    ],
    [categories, setCategoryMutation],
  );

  return (
    <Stack gap="4">
      <Heading size="lg">Itens</Heading>

      <Box borderWidth="1px" borderRadius="md" p={4}>
        <Text fontWeight="medium" mb={3}>
          Mesclar itens duplicados
        </Text>
        <HStack gap={2} wrap="wrap" align="end">
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

      <Flex>
        <Input
          size="sm"
          maxW="sm"
          placeholder="Buscar item..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Flex>

      <TableWithService
        columns={columns}
        parameters={{ search }}
        onSearch={useItems}
        orderBy={{ id: 'name', desc: false }}
      />
    </Stack>
  );
}
