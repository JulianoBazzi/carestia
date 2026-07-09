'use client';

import { Flex, Heading, HStack, Input, Stack, Text } from '@chakra-ui/react';
import { useDebounce } from '@julianobazzi/nextjs-utils';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { LuPencil, LuPlus, LuTrash2 } from 'react-icons/lu';
import { CompanyModal, type CompanyModalHandle } from '~/app/companies/components/modal';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import { ActionIconButton } from '~/components/Button/IconButton';
import { ConfirmDialog, type ConfirmDialogHandle } from '~/components/Form/ConfirmDialog';
import { type CustomColumnDef, TableWithService } from '~/components/Form/TableWithService';
import { API_URL_COMPANIES, TABLE_COMPANIES } from '~/config/constants';
import { useFeedback } from '~/contexts/FeedbackContext';
import type ICompanyAPI from '~/models/Entity/Company/ICompanyAPI';
import { api } from '~/services/apiClient';
import { useCompanies } from '~/services/hooks/useCompanies';
import { queryClient } from '~/services/queryClient';

function addressOf(company: ICompanyAPI): string {
  return [company.city, company.state].filter(Boolean).join(' · ') || '—';
}

export function CompaniesCard() {
  const modalRef = useRef<CompanyModalHandle>(null);
  const confirmRef = useRef<ConfirmDialogHandle>(null);
  const { successFeedbackToast, errorFeedbackToast } = useFeedback();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`${API_URL_COMPANIES}/${id}`),
    async onSuccess() {
      successFeedbackToast('Empresa', 'Excluída com sucesso!');
      await queryClient.invalidateQueries({ queryKey: [TABLE_COMPANIES] });
    },
    onError(error: Error) {
      errorFeedbackToast('Empresa', error);
    },
  });

  const columns = useMemo<CustomColumnDef<ICompanyAPI>[]>(
    () => [
      {
        id: 'document',
        header: 'CNPJ',
        enableSorting: false,
        cell: ({ row }) => (
          <Text fontVariantNumeric="tabular-nums">{row.original.format_document}</Text>
        ),
      },
      {
        accessorKey: 'fantasy_name',
        header: 'Nome fantasia',
        cell: ({ row }) => (
          <Text fontWeight="medium">{row.original.fantasy_name || row.original.social_name}</Text>
        ),
      },
      {
        accessorKey: 'social_name',
        header: 'Razão social',
        cell: (info) => info.getValue<string>(),
      },
      {
        id: 'address',
        header: 'Localização',
        enableSorting: false,
        cell: ({ row }) => addressOf(row.original),
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
                  title: 'Excluir empresa?',
                  description: `Tem certeza que deseja excluir "${row.original.fantasy_name || row.original.social_name}"? As notas já importadas continuam disponíveis.`,
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
            Empresas
          </Heading>
          <Text fontSize="sm" color="fg.muted">
            Fornecedores identificados nas suas notas fiscais.
          </Text>
        </Stack>
        <PrimaryButton size="sm" onClick={() => modalRef.current?.onOpenDialog()}>
          <LuPlus /> Nova empresa
        </PrimaryButton>
      </Flex>

      <Input
        size="sm"
        maxW="sm"
        bg="bg.surface"
        placeholder="Buscar por nome ou CNPJ..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <TableWithService
        columns={columns}
        parameters={{ search: debouncedSearch }}
        onSearch={useCompanies}
        orderBy={{ id: 'social_name', desc: false }}
        onRowClick={(company) => modalRef.current?.onOpenDialog(company)}
      />

      <CompanyModal ref={modalRef} />
      <ConfirmDialog ref={confirmRef} />
    </Stack>
  );
}
