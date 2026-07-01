import { redirect } from 'next/navigation';
import { ItemInflationDetail } from '~/app/inflation/[itemId]/components/detail';
import Template from '~/components/Template';
import { getSession } from '~/lib/auth/current-user';

export default async function ItemInflationPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const { itemId } = await params;

  return (
    <Template>
      <ItemInflationDetail itemId={itemId} />
    </Template>
  );
}
