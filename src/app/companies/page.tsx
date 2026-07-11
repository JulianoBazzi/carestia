import { redirect } from 'next/navigation';
import { CompaniesCard } from '~/app/companies/components/card';
import Template from '~/components/Template';
import { getSession, isAdmin } from '~/lib/auth/current-user';

export default async function CompaniesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <Template>
      <CompaniesCard canManage={isAdmin(session)} />
    </Template>
  );
}
