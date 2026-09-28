import { PublicHome } from '~/app/components/public-home';
import { getSession } from '~/lib/auth/current-user';

export default async function HomePage() {
  // Mesma tela para todo mundo: logado só troca o topo (menu do app) e os CTAs.
  const session = await getSession();
  const user = session ? { name: session.name, email: session.email } : null;

  return <PublicHome user={user} />;
}
