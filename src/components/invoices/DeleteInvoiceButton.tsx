'use client';

import { Button } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function DeleteInvoiceButton({
  id,
  redirectTo,
  size = 'xs',
}: {
  id: string;
  redirectTo?: string;
  size?: 'xs' | 'sm';
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    if (!confirm('Excluir esta nota?')) return;
    setLoading(true);
    const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
    setLoading(false);
    if (res.ok) {
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    }
  }

  return (
    <Button size={size} variant="outline" colorPalette="red" loading={loading} onClick={onDelete}>
      Excluir
    </Button>
  );
}
