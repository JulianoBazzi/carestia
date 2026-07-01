import { redirect } from 'next/navigation';
import { PublicHome } from '~/app/components/public-home';
import { getSession } from '~/lib/auth/current-user';

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect('/dashboard');
  return <PublicHome />;
}
