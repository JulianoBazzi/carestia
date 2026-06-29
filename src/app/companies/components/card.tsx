'use client';

import { Heading, Input, Stack } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { type CustomColumnDef, TableWithService } from '~/components/Form/TableWithService';
import type ICompanyAPI from '~/models/Entity/Company/ICompanyAPI';
import { useCompanies } from '~/services/hooks/useCompanies';

export function CompaniesCard() {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const columns = useMemo<CustomColumnDef<ICompanyAPI>[]>(
    () => [
      {
        accessorKey: 'social_name',
        header: 'Empresa',
        cell: ({ row }) => row.original.fantasy_name || row.original.social_name,
      },
      {
        id: 'document',
        header: 'CNPJ',
        enableSorting: false,
        cell: ({ row }) => row.original.format_document,
      },
      { accessorKey: 'city', header: 'Cidade', cell: (info) => info.getValue<string>() ?? '' },
    ],
    [],
  );

  return (
    <Stack gap="4">
      <Heading size="lg">Empresas</Heading>

      <Input
        size="sm"
        maxW="sm"
        placeholder="Buscar por nome ou CNPJ..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <TableWithService
        columns={columns}
        parameters={{ search }}
        onSearch={useCompanies}
        orderBy={{ id: 'social_name', desc: false }}
        onRowClick={(company) => router.push(`/companies/${company.id}`)}
      />
    </Stack>
  );
}
