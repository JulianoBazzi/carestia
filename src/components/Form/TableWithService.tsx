'use client';

import {
  Flex,
  HStack,
  Icon,
  IconButton,
  NativeSelect,
  Skeleton,
  Table,
  Text,
} from '@chakra-ui/react';
import { useLocalStorage } from '@julianobazzi/nextjs-utils';
import type { QueryObserverOptions, UseQueryResult } from '@tanstack/react-query';
import {
  type ColumnDef,
  type ColumnSort,
  flexRender,
  getCoreRowModel,
  type PaginationState,
  type SortDirection,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import {
  RiArrowDownSFill,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiArrowUpSFill,
  RiSkipLeftLine,
  RiSkipRightLine,
  RiSubtractLine,
} from 'react-icons/ri';
import type IEntityBase from '~/models/Entity/Base/IEntityBase';
import type IParamsRequest from '~/models/Request/Base/IParamsRequest';
import { OrderByTypeEnum } from '~/models/Request/Base/IParamsRequest';
import type IListResponse from '~/models/Response/IListResponse';

export type CustomColumnDef<T> = ColumnDef<T> & {
  accessorKey?: keyof T;
  sortByColumn?: keyof T;
};

export type ITableWithServiceProps<
  T extends IEntityBase,
  P extends IParamsRequest = IParamsRequest,
> = {
  columns: CustomColumnDef<T>[];
  orderBy?: ColumnSort;
  parameters?: Omit<P, 'perPage' | 'orderBy' | 'sortedBy'>;
  onSearch: (
    params?: P,
    options?: Omit<QueryObserverOptions<IListResponse<T>>, 'queryKey' | 'queryFn'>,
  ) => UseQueryResult<IListResponse<T>, unknown>;
  onRowClick?: (data: T) => void;
};

const emptyArray: never[] = [];
const pageSizeDefault = 20;
const pageSizes = [10, 20, 50, 100];

export function TableWithService<T extends IEntityBase, P extends IParamsRequest = IParamsRequest>({
  columns,
  orderBy = { id: 'created_at', desc: true },
  parameters,
  onSearch,
  onRowClick,
}: ITableWithServiceProps<T, P>) {
  // Page size é uma preferência de UI: persiste entre visitas/sessões.
  const [storedPageSize, setStoredPageSize] = useLocalStorage('table:pageSize', pageSizeDefault);
  const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: storedPageSize,
  });
  const [sorting, setSorting] = useState<SortingState>([orderBy]);

  const pagination = useMemo(() => ({ pageIndex, pageSize }), [pageIndex, pageSize]);

  const { data, isLoading, isFetching, error } = onSearch({
    ...parameters,
    page: pageIndex + 1,
    perPage: pageSize,
    orderBy: sorting.length > 0 ? sorting[0].id : undefined,
    sortedBy:
      sorting.length > 0
        ? sorting[0].desc
          ? OrderByTypeEnum.Desc
          : OrderByTypeEnum.Asc
        : undefined,
  } as P);

  const { getRowModel, getHeaderGroups, getPageCount, setPageIndex } = useReactTable({
    columns,
    data: data?.data ?? emptyArray,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    pageCount: data?.meta.last_page ?? -1,
    manualPagination: true,
    manualSorting: true,
    state: { pagination, sorting },
  });

  function getSortByField(columnId: string): string {
    const field = columns.find((c) => c.accessorKey === columnId);
    return field?.sortByColumn ? String(field.sortByColumn) : columnId;
  }

  function getIsSorted(columnId: string): false | SortDirection {
    const sortField = getSortByField(columnId);
    const current = sorting.find((s) => s.id === sortField);
    if (!current) return false;
    return current.desc ? 'desc' : 'asc';
  }

  function toggleSort(columnId: string) {
    const sortId = getSortByField(columnId);
    const current = sorting.find((s) => s.id === sortId);
    if (!current) setSorting([{ id: sortId, desc: false }]);
    else if (!current.desc) setSorting([{ id: sortId, desc: true }]);
    else setSorting([]);
  }

  const totalRecords = data?.meta.total ?? 0;
  const from = data?.meta.from ?? 0;
  const to = data?.meta.to ?? 0;
  const pageCount = getPageCount();
  const canPrevious = pageIndex > 0;
  const canNext = pageIndex + 1 < pageCount;

  return (
    <>
      <Table.ScrollArea maxW="100%">
        <Table.Root size="sm" variant="outline">
          <Table.Header>
            {getHeaderGroups().map((headerGroup) => (
              <Table.Row key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = getIsSorted(header.column.id);
                  return (
                    <Table.ColumnHeader key={header.id} color="teal.600">
                      <Flex
                        align="center"
                        gap="1"
                        cursor={canSort ? 'pointer' : 'default'}
                        onClick={() => canSort && toggleSort(header.column.id)}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort &&
                          (sorted === 'asc' ? (
                            <Icon as={RiArrowUpSFill} />
                          ) : sorted === 'desc' ? (
                            <Icon as={RiArrowDownSFill} />
                          ) : (
                            <Icon as={RiSubtractLine} color="gray.300" />
                          ))}
                      </Flex>
                    </Table.ColumnHeader>
                  );
                })}
              </Table.Row>
            ))}
          </Table.Header>
          <Table.Body>
            {isLoading &&
              Array.from({ length: 5 }).map((_, rowIndex) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton estático
                <Table.Row key={rowIndex}>
                  {columns.map((_col, colIndex) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: skeleton estático
                    <Table.Cell key={colIndex}>
                      <Skeleton height="16px" />
                    </Table.Cell>
                  ))}
                </Table.Row>
              ))}
            {!isLoading &&
              getRowModel().rows.map((row) => (
                <Table.Row
                  key={row.id}
                  {...(onRowClick && { cursor: 'pointer', _hover: { bg: 'teal.50' } })}
                >
                  {row.getVisibleCells().map((cell) => (
                    <Table.Cell
                      key={cell.id}
                      {...(onRowClick &&
                        cell.column.id !== 'actions' && {
                          onClick: () => onRowClick(row.original),
                        })}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </Table.Cell>
                  ))}
                </Table.Row>
              ))}
          </Table.Body>
        </Table.Root>
      </Table.ScrollArea>

      {totalRecords > 0 ? (
        <Flex mt="4" align="center" direction={['column', 'row']} gap={['3', '0']}>
          <Text mr={['inherit', 'auto']} color="fg.muted" fontSize="sm">
            {`Mostrando ${from} a ${to} de ${totalRecords} registros`}
          </Text>
          <HStack ml={['inherit', 'auto']} gap="1">
            <NativeSelect.Root size="sm" maxW="20">
              <NativeSelect.Field
                value={String(pageSize)}
                onChange={(e) => {
                  const size = Number(e.target.value);
                  setStoredPageSize(size);
                  setPagination({ pageIndex: 0, pageSize: size });
                }}
              >
                {pageSizes.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
            <IconButton
              size="sm"
              variant="ghost"
              aria-label="Primeira página"
              disabled={!canPrevious}
              onClick={() => setPageIndex(0)}
            >
              <RiSkipLeftLine />
            </IconButton>
            <IconButton
              size="sm"
              variant="ghost"
              aria-label="Página anterior"
              disabled={!canPrevious}
              onClick={() => setPageIndex(pageIndex - 1)}
            >
              <RiArrowLeftSLine />
            </IconButton>
            <Text fontSize="sm" px="2" whiteSpace="nowrap" flexShrink="0">
              {pageIndex + 1} de {pageCount || 1}
            </Text>
            <IconButton
              size="sm"
              variant="ghost"
              aria-label="Próxima página"
              disabled={!canNext}
              onClick={() => setPageIndex(pageIndex + 1)}
            >
              <RiArrowRightSLine />
            </IconButton>
            <IconButton
              size="sm"
              variant="ghost"
              aria-label="Última página"
              disabled={!canNext}
              onClick={() => setPageIndex(pageCount - 1)}
            >
              <RiSkipRightLine />
            </IconButton>
            {isFetching && !isLoading && <Skeleton height="4" w="4" borderRadius="full" />}
          </HStack>
        </Flex>
      ) : (
        !isLoading && (
          <Flex mt="8" justify="center">
            <Text color="fg.muted">
              {error ? 'Não foi possível buscar as informações.' : 'Nenhum registro encontrado.'}
            </Text>
          </Flex>
        )
      )}
    </>
  );
}
