'use client';

import { Circle, Menu, Portal, Text } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LuLogOut, LuUser } from 'react-icons/lu';

function initials(name: string, email: string): string {
  const source = name.trim() || email.trim();
  if (!source) return '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    setLoading(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <Menu.Root>
      <Menu.Trigger
        disabled={loading}
        focusRing="outside"
        borderRadius="full"
        aria-label="Menu da conta"
      >
        <Circle
          size="9"
          bg="teal.600"
          color="white"
          fontWeight="bold"
          fontSize="sm"
          cursor="pointer"
        >
          {initials(name, email)}
        </Circle>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="56">
            <Menu.ItemGroup>
              <Menu.ItemGroupLabel>
                <Text fontWeight="semibold" truncate>
                  {name || 'Minha conta'}
                </Text>
                <Text fontSize="xs" color="fg.muted" truncate>
                  {email}
                </Text>
              </Menu.ItemGroupLabel>
            </Menu.ItemGroup>
            <Menu.Separator />
            <Menu.Item value="account" onClick={() => router.push('/account')}>
              <LuUser />
              Minha conta
            </Menu.Item>
            <Menu.Item value="logout" color="fg.error" onClick={onLogout}>
              <LuLogOut />
              Sair
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
