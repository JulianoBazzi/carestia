import { redirect } from 'next/navigation';
import { InvoicesCard } from '~/app/invoices/components/card';
import Template from '~/components/Template';
import { getSession } from '~/lib/auth/current-user';

export default async function InvoicesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <Template>
      <InvoicesCard />
    </Template>
  );
}
