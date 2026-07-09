import { redirect } from 'next/navigation';
import { AccountCard } from '~/app/account/components/account-card';
import Template from '~/components/Template';
import { getSession } from '~/lib/auth/current-user';

export const metadata = { title: 'Minha conta' };

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <Template>
      <AccountCard name={session.name} email={session.email} />
    </Template>
  );
}
