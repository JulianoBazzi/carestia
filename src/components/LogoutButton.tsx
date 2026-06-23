'use client';

import { Button } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    setLoading(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" loading={loading} onClick={onLogout}>
      Sair
    </Button>
  );
}
