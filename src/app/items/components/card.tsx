'use client';

import { Box, Flex, Heading, HStack, Input, Stack, Text } from '@chakra-ui/react';
import { useDebounce } from '@julianobazzi/nextjs-utils';
import { formatDate } from '@julianobazzi/utils';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { LuBan, LuPencil, LuPlus, LuSparkles, LuTags } from 'react-icons/lu';
import { AliasesModal, type AliasesModalHandle } from '~/app/items/components/aliases-modal';
import {
  CategorizeModal,
  type CategorizeModalHandle,
} from '~/app/items/components/categorize-modal';
import { ItemModal, type ItemModalHandle } from '~/app/items/components/modal';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import { ActionIconButton } from '~/components/Button/IconButton';
import { formatCategoryOption, toCategoryOptions } from '~/components/Form/CategorySelectOption';
import { ConfirmDialog, type ConfirmDialogHandle } from '~/components/Form/ConfirmDialog';
import { Select } from '~/components/Form/Select';
import { SelectWithService } from '~/components/Form/SelectWithService';
import { type CustomColumnDef, TableWithService } from '~/components/Form/TableWithService';
import {
  API_URL_ITEMS,
  TABLE_INFLATION,
  TABLE_ITEMS,
  TABLE_PUBLIC_PRICES,
} from '~/config/constants';
import { useFeedback } from '~/contexts/FeedbackContext';
import { formatPrice } from '~/lib/format';
import type IItemAPI from '~/models/Entity/Item/IItemAPI';
import { OrderByTypeEnum } from '~/models/Request/Base/IParamsRequest';
import { api } from '~/services/apiClient';
import { useCategories } from '~/services/hooks/useCategories';
import { getItems, useItems } from '~/services/hooks/useItems';
import { queryClient } from '~/services/queryClient';

// Neste momento a tela trata só de produtos: o tipo é fixo em toda consulta
// (listagem, contador de não-categorizados e selects de mesclagem). Constante
// fora do componente porque `parameters` entra na key de remount do select.
const PRODUCT_ONLY = { type: 'product' } as const;

interface ItemsCardProps {
  aiEnabled: boolean;
  canManage: boolean;
}

/**
 * Ignorar/mesclar mexe nas linhas que alimentam o índice pessoal e o público —
 * não só na lista de itens.
 */
function invalidateItemDependents() {
  return Promise.all(
    [TABLE_ITEMS, TABLE_INFLATION, TABLE_PUBLIC_PRICES].map((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    ),
  );
}

export function ItemsCard({ aiEnabled, canManage }: ItemsCardProps) {
  const modalRef = useRef<ItemModalHandle>(null);
  const confirmRef = useRef<ConfirmDialogHandle>(null);
  const categorizeModalRef = useRef<CategorizeModalHandle>(null);
  const aliasesModalRef = useRef<AliasesModalHandle>(null);
  const { successFeedbackToast, errorFeedbackToast } = useFeedback();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [source, setSource] = useState<IItemAPI | null>(null);
  const [target, setTarget] = useState<IItemAPI | null>(null);

  const categoriesQuery = useCategories({
    perPage: 100,
    orderBy: 'name',
    sortedBy: OrderByTypeEnum.Asc,
  });
  // Usado apenas para o contador de itens sem categoria (limitado a 100, como antes).
  const itemsQuery = useItems({ perPage: 100, ...PRODUCT_ONLY });
  const categories = categoriesQuery.data?.data ?? [];
  const allItems = itemsQuery.data?.data ?? [];
  const categoryOptions = useMemo(() => toCategoryOptions(categories), [categories]);

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
      successFeedbackToast('Item', 'Item ignorado.');
      await invalidateItemDependents();
    },
    onError(error: Error) {
      errorFeedbackToast('Item', error);
    },
  });

  const mergeMutation = useMutation({
    mutationFn: () =>
      api.post('/api/items/merge', {
        sourceId: source?.id,
        targetId: target?.id,
      }),
    async onSuccess() {
      successFeedbackToast('Itens', 'Mesclados com sucesso!');
      setSource(null);
      setTarget(null);
      await invalidateItemDependents();
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
        accessorKey: 'unit',
        header: 'Unidade',
        cell: ({ row }) => <Text color="fg.muted">{row.original.unit ?? '—'}</Text>,
      },
      {
        accessorKey: 'name',
        header: 'Nome',
        // maxW limita a coluna (o table layout dimensiona pelo conteúdo) e o
        // nome quebra em múltiplas linhas em vez de esticar indefinidamente.
        cell: ({ row }) => (
          <Text fontWeight="medium" maxW="96" whiteSpace="normal">
            {row.original.name}
          </Text>
        ),
      },
      {
        id: 'avg_price',
        header: 'Preço médio (12m)',
        // Agregado calculado na API: não está no SORTABLE da rota.
        enableSorting: false,
        cell: ({ row }) => {
          const { avg_price, price_samples, last_price_at } = row.original;
          // `typeof` e não `=== null`: resposta antiga/sem o campo (cache do
          // client, deploy no meio do caminho) não pode quebrar a listagem.
          if (typeof avg_price !== 'number') {
            return <Text color="fg.subtle">—</Text>;
          }
          return (
            <Stack gap="0">
              <Text fontVariantNumeric="tabular-nums">{formatPrice(avg_price)}</Text>
              <Text fontSize="xs" color="fg.muted" whiteSpace="nowrap">
                {price_samples === 1 ? '1 registro' : `${price_samples ?? 0} registros`}
                {last_price_at ? ` · ${formatDate(last_price_at)}` : ''}
              </Text>
            </Stack>
          );
        },
      },
      {
        id: 'category',
        header: 'Categoria',
        cell: ({ row }) => (
          <Box maxW="48" minW="40">
            <Select
              // instanceId único por linha (evita ids duplicados no DOM).
              name={`category-${row.original.id}`}
              size="sm"
              usePortal
              placeholder="Sem categoria"
              options={categoryOptions}
              formatOptionLabel={formatCategoryOption}
              value={row.original.category_id}
              onChange={(v) =>
                setCategoryMutation.mutate({
                  id: row.original.id,
                  categoryId: v,
                })
              }
            />
          </Box>
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
                aria-label="Nomes alternativos"
                onClick={() => aliasesModalRef.current?.open(row.original)}
              >
                <LuTags />
              </ActionIconButton>
            )}
            {canManage && (
              <ActionIconButton
                aria-label="Ignorar"
                colorPalette="red"
                onClick={() =>
                  confirmRef.current?.open({
                    title: 'Ignorar item?',
                    description: `Tem certeza que deseja ignorar "${row.original.name}"? Ele sairá das listagens e dos índices e nunca será recriado por importações futuras. As notas já importadas continuam intactas. Esta ação não pode ser desfeita.`,
                    onConfirm: async () => {
                      await removeMutation.mutateAsync(row.original.id);
                    },
                  })
                }
              >
                <LuBan />
              </ActionIconButton>
            )}
          </HStack>
        ),
      },
    ],
    [categoryOptions, setCategoryMutation, removeMutation, canManage],
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

      <Flex justify="end" align="center" gap="3" wrap="wrap">
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
        parameters={{ search: debouncedSearch, ...PRODUCT_ONLY }}
        onSearch={useItems}
        orderBy={{ id: 'name', desc: false }}
      />

      {canManage && (
        <Box borderWidth="1px" borderRadius="lg" p="4" bg="bg.surface">
          <Text fontWeight="semibold" mb="1" fontSize="sm">
            Mesclar itens duplicados
          </Text>
          <Text fontSize="xs" color="fg.muted" mb="3">
            Reaponta o histórico de um item para outro e remove o duplicado.
          </Text>
          <HStack gap="2" wrap="wrap" align="end">
            <Box w="40%">
              <SelectWithService<IItemAPI>
                name="merge-source"
                size="sm"
                placeholder="Item de origem (será removido)"
                onSearch={getItems}
                parameters={PRODUCT_ONLY}
                value={source}
                onChange={setSource}
                disabled={mergeMutation.isPending}
              />
            </Box>
            <Box w="40%">
              <SelectWithService<IItemAPI>
                name="merge-target"
                size="sm"
                placeholder="Item de destino (será mantido)"
                onSearch={getItems}
                parameters={PRODUCT_ONLY}
                value={target}
                onChange={setTarget}
                disabled={mergeMutation.isPending}
              />
            </Box>
            <PrimaryButton
              size="sm"
              loading={mergeMutation.isPending}
              onClick={() => {
                if (!source || !target || source.id === target.id) {
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
      )}

      <ItemModal ref={modalRef} canEditEan={canManage} />
      <ConfirmDialog ref={confirmRef} />
      <CategorizeModal ref={categorizeModalRef} />
      <AliasesModal ref={aliasesModalRef} />
    </Stack>
  );
}
