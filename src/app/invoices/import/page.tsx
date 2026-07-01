import { Stack } from '@chakra-ui/react';
import { redirect } from 'next/navigation';
import { EnergyPdfImport } from '~/app/invoices/import/components/energy-pdf';
import { InvoiceImport } from '~/app/invoices/import/components/import';
import Template from '~/components/Template';
import { getSession } from '~/lib/auth/current-user';

export default async function InvoiceImportPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <Template>
      <Stack gap="6">
        <InvoiceImport />
        <EnergyPdfImport />
      </Stack>
    </Template>
  );
}
