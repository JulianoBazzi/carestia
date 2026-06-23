import { Box, Container, Text } from '@chakra-ui/react';
import { redirect } from 'next/navigation';
import { AppHeader } from '~/components/AppHeader';
import { ItemsManager } from '~/components/items/ItemsManager';
import { getSession } from '~/lib/auth/current-user';
import { listCategories, listItems } from '~/services/management';

export default async function ItemsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [items, categories] = await Promise.all([listItems(), listCategories()]);

  return (
    <Box minH="100dvh">
      <Container maxW="5xl" py={{ base: 4, md: 8 }}>
        <AppHeader />
        {items.length === 0 ? (
          <Text color="fg.muted">Nenhum item ainda. Importe notas para popular o catálogo.</Text>
        ) : (
          <ItemsManager
            items={items.map((i) => ({
              id: i.id,
              name: i.name,
              reference_code: i.reference_code,
              type: i.type,
              categoryId: i.category?.id ?? null,
              usageCount: i._count.invoice_items,
            }))}
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          />
        )}
      </Container>
    </Box>
  );
}
