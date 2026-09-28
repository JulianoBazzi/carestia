import { redirect } from 'next/navigation';
import { InvoiceImportKey } from '~/app/invoices/import/key/components/import-key';
import Template from '~/components/Template';
import { getSession, isAdmin } from '~/lib/auth/current-user';
import { isInfosimplesEnabled } from '~/services/invoice/infosimples';

export default async function InvoiceImportKeyPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  // Recurso restrito ao admin: usuários comuns não veem a tela de importação por chave.
  if (!isAdmin(session)) {
    redirect('/invoices');
  }

  return (
    <Template>
      <InvoiceImportKey enabled={isInfosimplesEnabled()} />
    </Template>
  );
}
