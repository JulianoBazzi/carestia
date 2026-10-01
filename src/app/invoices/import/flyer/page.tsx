import { redirect } from 'next/navigation';
import { FlyerImport } from '~/app/invoices/import/flyer/components/import-flyer';
import Template from '~/components/Template';
import { getSession, isAdmin } from '~/lib/auth/current-user';
import { isAiEnabled } from '~/services/openai';

export default async function FlyerImportPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  // Recurso restrito ao admin: leitura paga (OpenAI) que alimenta o índice público.
  if (!isAdmin(session)) {
    redirect('/invoices');
  }

  return (
    <Template>
      <FlyerImport enabled={isAiEnabled()} />
    </Template>
  );
}
