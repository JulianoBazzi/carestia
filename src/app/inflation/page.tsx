import { redirect } from 'next/navigation';
import { InflationCard } from '~/app/inflation/components/card';
import Template from '~/components/Template';
import { getSession } from '~/lib/auth/current-user';

export default async function InflationPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <Template>
      <InflationCard />
    </Template>
  );
}
