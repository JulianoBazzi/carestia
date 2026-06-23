'use client';

import { Button, HStack, Text } from '@chakra-ui/react';
import { useRouter, useSearchParams } from 'next/navigation';

export function Pagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function go(next: number) {
    const sp = new URLSearchParams(params.toString());
    sp.set('page', String(next));
    router.push(`/invoices?${sp.toString()}`);
  }

  return (
    <HStack justify="space-between">
      <Text fontSize="sm" color="fg.muted">
        {total} nota(s) · página {page} de {totalPages}
      </Text>
      <HStack gap={2}>
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => go(page - 1)}>
          Anterior
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => go(page + 1)}
        >
          Próxima
        </Button>
      </HStack>
    </HStack>
  );
}
