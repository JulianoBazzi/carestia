import { Circle, Link as CLink, Heading, HStack, Icon, Stack, Text } from '@chakra-ui/react';
import { formatCNPJ } from '@julianobazzi/utils';
import NextLink from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { LuArrowLeft, LuBuilding2 } from 'react-icons/lu';
import { CompanyEditForm } from '~/app/companies/[id]/components/edit-form';
import Template from '~/components/Template';
import { getSession } from '~/lib/auth/current-user';
import { getCompany } from '~/services/management';

export default async function CompanyEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { id } = await params;
  const company = await getCompany(id);
  if (!company) notFound();

  return (
    <Template>
      <Stack gap={6}>
        <CLink
          asChild
          fontSize="sm"
          color="fg.muted"
          w="fit-content"
          _hover={{ color: 'teal.600' }}
        >
          <NextLink href="/invoices">
            <HStack gap={1}>
              <Icon>
                <LuArrowLeft />
              </Icon>
              Voltar para notas
            </HStack>
          </NextLink>
        </CLink>

        <HStack gap={3}>
          <Circle size="11" bg={{ base: 'teal.50', _dark: 'teal.950' }} color="teal.500">
            <LuBuilding2 size={22} />
          </Circle>
          <Stack gap={0}>
            <Heading size="md">{company.fantasy_name || company.social_name}</Heading>
            <Text color="fg.muted" fontSize="sm">
              {formatCNPJ(company.document)}
            </Text>
          </Stack>
        </HStack>

        <CompanyEditForm
          id={company.id}
          defaults={{
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
    </Template>
  );
}
