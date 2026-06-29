'use client';

import { Badge, Heading, HStack, Input, NativeSelect, Stack, Text } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { type CustomColumnDef, TableWithService } from '~/components/Form/TableWithService';
import { InvoiceUpload } from '~/components/InvoiceUpload';
import { DeleteInvoiceButton } from '~/components/invoices/DeleteInvoiceButton';
import type IInvoiceAPI from '~/models/Entity/Invoice/IInvoiceAPI';
import type IInvoiceParamsRequest from '~/models/Request/IInvoiceParamsRequest';
import { useInvoices } from '~/services/hooks/useInvoices';

export function InvoicesCard() {
  const router = useRouter();
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');

  const columns = useMemo<CustomColumnDef<IInvoiceAPI>[]>(
    () => [
      {
        id: 'company',
        header: 'Empresa',
        enableSorting: false,
        cell: ({ row }) => row.original.company_name,
      },
      {
        id: 'document',
        header: 'CNPJ',
        enableSorting: false,
        cell: ({ row }) => row.original.format_document,
      },
      {
        id: 'model',
        header: 'Tipo',
        enableSorting: false,
        cell: ({ row }) => (
          <Badge colorPalette={row.original.model === 'nfe' ? 'blue' : 'purple'}>
            {row.original.model === 'nfe' ? 'Produto' : 'Serviço'}
          </Badge>
        ),
      },
      {
        id: 'issued_at',
        header: 'Data',
        enableSorting: false,
        cell: ({ row }) => row.original.format_issued_at,
      },
      {
        id: 'items_count',
        header: 'Itens',
        enableSorting: false,
        cell: ({ row }) => row.original.items_count,
      },
      {
        id: 'total_value',
        header: 'Total',
        enableSorting: false,
        cell: ({ row }) => <Text textAlign="end">{row.original.format_total}</Text>,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => <DeleteInvoiceButton id={row.original.id} />,
      },
    ],
    [],
  );

  return (
    <Stack gap="4">
      <Heading size="lg">Notas</Heading>

      <InvoiceUpload />

      <HStack gap={2} wrap="wrap" align="end">
        <NativeSelect.Root size="sm" maxW="40">
          <NativeSelect.Field value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="nfe">Produto (NF-e)</option>
            <option value="nfse">Serviço (NFS-e)</option>
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        <Input
          size="sm"
          type="date"
          maxW="40"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <Input size="sm" type="date" maxW="40" value={to} onChange={(e) => setTo(e.target.value)} />
        <Input
          size="sm"
          maxW="48"
          placeholder="Empresa ou item"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </HStack>

      <TableWithService<IInvoiceAPI, IInvoiceParamsRequest>
        columns={columns}
        parameters={{
          type: (type || null) as 'nfe' | 'nfse' | null,
          from: from || null,
          to: to || null,
          search,
        }}
        onSearch={useInvoices}
        onRowClick={(invoice) => router.push(`/invoices/${invoice.id}`)}
      />
    </Stack>
  );
}
