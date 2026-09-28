import { redirect } from 'next/navigation';
import { DashboardCard } from '~/app/components/dashboard-card';
import Template from '~/components/Template';
import { getSession } from '~/lib/auth/current-user';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  return (
    <Template>
      <DashboardCard />
    </Template>
  );
}
