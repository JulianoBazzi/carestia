'use client';

import { Box, Button, HStack, NativeSelect, Stack, Table, Text } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toaster } from '~/components/ui/toaster';

export interface IManagedItem {
  id: string;
  name: string;
  reference_code: string;
  type: 'product' | 'service';
  categoryId: string | null;
  usageCount: number;
}

export interface IManagedCategory {
  id: string;
  name: string;
}

export function ItemsManager({
  items,
  categories,
}: {
  items: IManagedItem[];
  categories: IManagedCategory[];
}) {
  const router = useRouter();
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');

  async function setCategory(itemId: string, categoryId: string) {
    const res = await fetch(`/api/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId || null }),
    });
    if (res.ok) {
      toaster.create({ type: 'success', title: 'Categoria atualizada' });
      router.refresh();
    } else {
      toaster.create({ type: 'error', title: 'Falha ao atualizar' });
    }
  }

  async function merge() {
    if (!source || !target || source === target) {
      toaster.create({
        type: 'error',
        title: 'Selecione dois itens diferentes',
      });
      return;
    }
    const res = await fetch('/api/items/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId: source, targetId: target }),
    });
    if (res.ok) {
      toaster.create({ type: 'success', title: 'Itens mesclados' });
      setSource('');
      setTarget('');
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toaster.create({
        type: 'error',
        title: 'Falha ao mesclar',
        description: data.error,
      });
    }
  }

  return (
    <Stack gap={6}>
      <Box borderWidth="1px" borderRadius="md" p={4}>
        <Text fontWeight="medium" mb={3}>
          Mesclar itens duplicados
        </Text>
        <HStack gap={2} wrap="wrap" align="end">
          <NativeSelect.Root size="sm" maxW="64">
            <NativeSelect.Field value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">Item de origem (será removido)</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
          <NativeSelect.Root size="sm" maxW="64">
            <NativeSelect.Field value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Item de destino (será mantido)</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
          <Button size="sm" onClick={merge}>
            Mesclar
          </Button>
        </HStack>
      </Box>

      <Table.Root size="sm" variant="outline">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>Item</Table.ColumnHeader>
            <Table.ColumnHeader>Ref</Table.ColumnHeader>
            <Table.ColumnHeader>Tipo</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="end">Usos</Table.ColumnHeader>
            <Table.ColumnHeader>Categoria</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {items.map((item) => (
            <Table.Row key={item.id}>
              <Table.Cell>{item.name}</Table.Cell>
              <Table.Cell>{item.reference_code}</Table.Cell>
              <Table.Cell>{item.type === 'product' ? 'Produto' : 'Serviço'}</Table.Cell>
              <Table.Cell textAlign="end">{item.usageCount}</Table.Cell>
              <Table.Cell>
                <NativeSelect.Root size="sm" maxW="48">
                  <NativeSelect.Field
                    defaultValue={item.categoryId ?? ''}
                    onChange={(e) => setCategory(item.id, e.target.value)}
                  >
                    <option value="">Sem categoria</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Stack>
  );
}
