import { Box, Container, Heading, Stack } from '@chakra-ui/react';
import { notFound, redirect } from 'next/navigation';
import { AppHeader } from '~/components/AppHeader';
import { CompanyEditForm } from '~/components/CompanyEditForm';
import { getSession } from '~/lib/auth/current-user';
import { getCompany } from '~/services/management';

export default async function CompanyEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { id } = await params;
  const company = await getCompany(id);
  if (!company) notFound();

  return (
    <Box minH="100dvh">
      <Container maxW="4xl" py={{ base: 4, md: 8 }}>
        <AppHeader />
        <Stack gap={6}>
          <Heading size="md">Editar empresa</Heading>
          <CompanyEditForm
            company={{
              id: company.id,
              social_name: company.social_name,
              fantasy_name: company.fantasy_name ?? '',
              street: company.street ?? '',
              number: company.number ?? '',
              neighborhood: company.neighborhood ?? '',
              city: company.city ?? '',
              state: company.state ?? '',
              zipcode: company.zipcode ?? '',
            }}
          />
        </Stack>
      </Container>
    </Box>
  );
}
