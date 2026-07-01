import { redirect } from 'next/navigation';
import { InvoiceImportKey } from '~/app/invoices/import/key/components/import-key';
import Template from '~/components/Template';
import { getSession } from '~/lib/auth/current-user';
import { isInfosimplesEnabled } from '~/services/invoice/infosimples';

export default async function InvoiceImportKeyPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <Template>
      <InvoiceImportKey enabled={isInfosimplesEnabled()} />
    </Template>
  );
}
