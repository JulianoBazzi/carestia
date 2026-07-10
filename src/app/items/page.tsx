import { redirect } from 'next/navigation';
import { ItemsCard } from '~/app/items/components/card';
import Template from '~/components/Template';
import { getSession } from '~/lib/auth/current-user';
import { isAiEnabled } from '~/services/openai';

export default async function ItemsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <Template>
      <ItemsCard aiEnabled={isAiEnabled()} />
    </Template>
  );
}
