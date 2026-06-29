import { redirect } from 'next/navigation';
import { CategoriesCard } from '~/app/categories/components/card';
import Template from '~/components/Template';
import { getSession } from '~/lib/auth/current-user';

export default async function CategoriesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <Template>
      <CategoriesCard />
    </Template>
  );
}
