'use client';

import { Button } from '@chakra-ui/react';
import { useState } from 'react';
import { LuLogOut } from 'react-icons/lu';
import { logout } from '~/lib/auth/client-session';

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    setLoading(true);
    await logout();
  }

  return (
    <Button variant="outline" size="sm" loading={loading} onClick={onLogout}>
      <LuLogOut />
      Sair
    </Button>
  );
}
