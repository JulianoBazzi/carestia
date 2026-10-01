'use client';

import { Button, Flex, Heading, HStack, Input, Stack, Text } from '@chakra-ui/react';
import { useDebounce } from '@julianobazzi/nextjs-utils';
import { useMutation } from '@tanstack/react-query';
import NextLink from 'next/link';
import { useMemo, useRef, useState } from 'react';
import {
  LuDownload,
  LuKeyRound,
  LuNewspaper,
  LuPencil,
  LuPlus,
  LuTrash2,
  LuUpload,
} from 'react-icons/lu';
import { InvoiceModal, type InvoiceModalHandle } from '~/app/invoices/components/modal';
import { AdSlot } from '~/components/Ad/AdSlot';
import { StatusBadge } from '~/components/Badge/StatusBadge';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import { ActionIconButton } from '~/components/Button/IconButton';
import { ConfirmDialog, type ConfirmDialogHandle } from '~/components/Form/ConfirmDialog';
import { Select } from '~/components/Form/Select';
import { SelectWithService } from '~/components/Form/SelectWithService';
import { type CustomColumnDef, TableWithService } from '~/components/Form/TableWithService';
import { API_URL_INVOICES, TABLE_INFLATION, TABLE_INVOICES } from '~/config/constants';
import { useFeedback } from '~/contexts/FeedbackContext';
import { maskAccessKey } from '~/lib/mask';
import type ICompanyAPI from '~/models/Entity/Company/ICompanyAPI';
import type IInvoiceAPI from '~/models/Entity/Invoice/IInvoiceAPI';
import type ISelectOption from '~/models/ISelectOption';
import type IInvoiceParamsRequest from '~/models/Request/IInvoiceParamsRequest';
import { api } from '~/services/apiClient';
import { getCompanies } from '~/services/hooks/useCompanies';
import { invoiceModelInfo, useInvoices } from '~/services/hooks/useInvoices';
import { queryClient } from '~/services/queryClient';

const TYPE_OPTIONS: ISelectOption[] = [
  { value: 'nfe', label: 'NF-e' },
  { value: 'nfce', label: 'NFC-e' },
  { value: 'nfse', label: 'NFS-e' },
  { value: 'nf3e', label: 'Energia' },
];

interface InvoicesCardProps {
  /** Admin: mostra as importações restritas (por chave, encarte). */
  adminImports: boolean;
}

export function InvoicesCard({ adminImports }: InvoicesCardProps) {
  const modalRef = useRef<InvoiceModalHandle>(null);
  const confirmRef = useRef<ConfirmDialogHandle>(null);
  const { successFeedbackToast, errorFeedbackToast } = useFeedback();
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [company, setCompany] = useState<ICompanyAPI | null>(null);
  const [search, setSearch] = useState('');
  // Evita refetch a cada tecla: a query usa o valor debounced; o input segue imediato.
  const debouncedSearch = useDebounce(search, 500);

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`${API_URL_INVOICES}/${id}`),
    async onSuccess() {
      successFeedbackToast('Nota', 'Excluída com sucesso!');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [TABLE_INVOICES] }),
        queryClient.invalidateQueries({ queryKey: [TABLE_INFLATION] }),
      ]);
    },
    onError(error: Error) {
      errorFeedbackToast('Nota', error);
    },
  });

  function exportCsv() {
    const rows = queryClient.getQueriesData<{ data: IInvoiceAPI[] }>({
      queryKey: [TABLE_INVOICES],
    });
    const list = rows.flatMap(([, v]) => v?.data ?? []);
    const header = ['Tipo', 'Numero', 'Serie', 'Chave', 'Emitente', 'Emissao', 'Itens'];
    const lines = list.map((i) =>
      [
        invoiceModelInfo(i.model).label,
        i.number,
        i.series ?? '',
        i.access_key,
        i.company_name ?? '',
        i.format_issued_at ?? '',
        i.items_count,
      ].join(';'),
    );
    const blob = new Blob([[header.join(';'), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'notas.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const columns = useMemo<CustomColumnDef<IInvoiceAPI>[]>(
    () => [
      {
        id: 'document',
        header: 'Documento',
        enableSorting: false,
        cell: ({ row }) => (
          <Stack gap="0">
            <Text fontWeight="medium" fontSize="sm">
              Nº {row.original.number}
              {row.original.series ? ` · Série ${row.original.series}` : ''}
            </Text>
            <Text fontSize="xs" color="fg.muted" fontFamily="mono">
              {maskAccessKey(row.original.access_key)}
            </Text>
          </Stack>
        ),
      },
      {
        id: 'model',
        header: 'Tipo',
        enableSorting: false,
        cell: ({ row }) => {
          const info = invoiceModelInfo(row.original.model);
          return (
            <StatusBadge withDot={false} label={info.label} colorPalette={info.colorPalette} />
          );
        },
      },
      {
        id: 'company',
        header: 'Emitente',
        enableSorting: false,
        cell: ({ row }) => (
          <Stack gap="0">
            <Text fontWeight="medium">{row.original.company_name}</Text>
            <Text fontSize="xs" color="fg.muted">
              {row.original.format_document}
            </Text>
          </Stack>
        ),
      },
      {
        id: 'issued_at',
        header: 'Emissão',
        enableSorting: false,
        cell: ({ row }) => row.original.format_issued_at,
      },
      {
        id: 'items_count',
        header: 'Itens',
        enableSorting: false,
        cell: ({ row }) => <Text textAlign="center">{row.original.items_count}</Text>,
      },
      {
        id: 'actions',
        header: 'Ações',
        enableSorting: false,
        cell: ({ row }) => (
          <HStack gap="1.5" justify="end">
            <ActionIconButton
              aria-label="Editar"
              onClick={() => modalRef.current?.onOpenDialog(row.original.id)}
            >
              <LuPencil />
            </ActionIconButton>
            <ActionIconButton
              aria-label="Excluir"
              colorPalette="red"
              onClick={() =>
                confirmRef.current?.open({
                  title: 'Excluir nota?',
                  description: `A nota ${row.original.number} de ${row.original.company_name} será removida da sua análise de inflação.`,
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
    [removeMutation],
  );

  return (
    <Stack gap="5">
      <Flex justify="space-between" align="center" gap="4" wrap="wrap">
        <Stack gap="0.5">
          <Heading size="lg" fontFamily="heading">
            Notas Importadas
          </Heading>
          <Text fontSize="sm" color="fg.muted">
            Revise, edite ou exclua as notas e itens já processados.
          </Text>
        </Stack>
        <HStack gap="2" wrap="wrap">
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <LuDownload /> Exportar
          </Button>
          <Button size="sm" variant="outline" onClick={() => modalRef.current?.onOpenDialog()}>
            <LuPlus /> Nova nota
          </Button>
          {adminImports && (
            <>
              <Button size="sm" variant="outline" asChild>
                <NextLink href="/invoices/import/flyer">
                  <LuNewspaper /> Importar encarte
                </NextLink>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <NextLink href="/invoices/import/key">
                  <LuKeyRound /> Importar por chave
                </NextLink>
              </Button>
            </>
          )}
          <PrimaryButton size="sm" asChild>
            <NextLink href="/invoices/import">
              <LuUpload /> Importar XML
            </NextLink>
          </PrimaryButton>
        </HStack>
      </Flex>

      <AdSlot variant="banner" />

      <HStack gap="2" wrap="wrap" align="end">
        <Select
          name="filter-type"
          size="sm"
          maxW="40"
          bg="bg.surface"
          clearable
          searchable={false}
          placeholder="Todos os tipos"
          options={TYPE_OPTIONS}
          value={type}
          onChange={(v) => setType(v ?? '')}
        />
        <SelectWithService<ICompanyAPI>
          name="filter-company"
          size="sm"
          maxW="56"
          bg="bg.surface"
          clearable
          placeholder="Todas as empresas"
          optionLabel={(c) => c.fantasy_name || c.social_name}
          orderBy="social_name"
          onSearch={getCompanies}
          value={company}
          onChange={setCompany}
        />
        <Input
          size="sm"
          type="date"
          maxW="40"
          bg="bg.surface"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <Input
          size="sm"
          type="date"
          maxW="40"
          bg="bg.surface"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <Input
          size="sm"
          maxW="56"
          bg="bg.surface"
          placeholder="Buscar nota, chave ou emitente"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </HStack>

      <TableWithService<IInvoiceAPI, IInvoiceParamsRequest>
        columns={columns}
        parameters={{
          type: (type || null) as IInvoiceParamsRequest['type'],
          from: from || null,
          to: to || null,
          company: company?.id ?? null,
          search: debouncedSearch,
        }}
        onSearch={useInvoices}
      />

      <InvoiceModal ref={modalRef} />
      <ConfirmDialog ref={confirmRef} />
    </Stack>
  );
}
