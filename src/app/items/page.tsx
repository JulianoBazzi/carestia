import { redirect } from 'next/navigation';
import { ItemsCard } from '~/app/items/components/card';
import Template from '~/components/Template';
import { getSession } from '~/lib/auth/current-user';

export default async function ItemsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <Template>
      <ItemsCard />
    </Template>
  );
}
