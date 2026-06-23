'use client';

import { Button, HStack, Input, NativeSelect } from '@chakra-ui/react';
import { useRouter, useSearchParams } from 'next/navigation';

export function InvoiceFilters() {
  const router = useRouter();
  const params = useSearchParams();

  function apply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const next = new URLSearchParams();
    for (const key of ['type', 'from', 'to', 'search']) {
      const value = String(form.get(key) ?? '').trim();
      if (value) next.set(key, value);
    }
    router.push(`/invoices?${next.toString()}`);
  }

  function clear() {
    router.push('/invoices');
  }

  return (
    <form onSubmit={apply}>
      <HStack gap={2} wrap="wrap" align="end">
        <NativeSelect.Root size="sm" maxW="40">
          <NativeSelect.Field name="type" defaultValue={params.get('type') ?? ''}>
            <option value="">Todos os tipos</option>
            <option value="nfe">Produto (NF-e)</option>
            <option value="nfse">Serviço (NFS-e)</option>
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        <Input
          size="sm"
          type="date"
          name="from"
          maxW="40"
          defaultValue={params.get('from') ?? ''}
        />
        <Input size="sm" type="date" name="to" maxW="40" defaultValue={params.get('to') ?? ''} />
        <Input
          size="sm"
          name="search"
          placeholder="Empresa ou item"
          maxW="48"
          defaultValue={params.get('search') ?? ''}
        />
        <Button size="sm" type="submit">
          Filtrar
        </Button>
        <Button size="sm" variant="ghost" type="button" onClick={clear}>
          Limpar
        </Button>
      </HStack>
    </form>
  );
}
