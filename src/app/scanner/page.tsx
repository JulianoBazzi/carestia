import { Box, Container } from '@chakra-ui/react';
import type { Metadata } from 'next';
import { ScannerPage, type ScannerTab } from '~/app/scanner/components/scanner-page';
import { PublicHeader } from '~/components/public/PublicHeader';
import { Header } from '~/components/Template/Header';
import { getSession } from '~/lib/auth/current-user';
import { isRegistrationOpen } from '~/lib/registration';
import { isInfosimplesEnabled } from '~/services/invoice/infosimples';
import { isAiEnabled } from '~/services/openai';

export const metadata: Metadata = { title: 'Scanner' };

const TABS: ScannerTab[] = ['barcode', 'label', 'nfce'];

/**
 * Tela mobile-first do scanner. Pública: consultar preço por código de barras
 * não exige login (mesma base anônima do Índice Geral). As abas de etiqueta e
 * de QR da NFC-e pedem login dentro da própria tela.
 */
export default async function ScannerRoute({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; ean?: string }>;
}) {
  const session = await getSession();
  const user = session ? { name: session.name, email: session.email } : null;
  const { tab, ean } = await searchParams;
  // EAN que o usuário escaneou antes de entrar (volta do login direto na etiqueta).
  const initialEan = ean && /^\d{8,14}$/.test(ean) ? ean : null;
  const initialTab = TABS.includes(tab as ScannerTab) ? (tab as ScannerTab) : 'barcode';

  return (
    <Box minH="100dvh" bg="bg.app">
      {user ? <Header user={user} /> : <PublicHeader />}
      <Container maxW="lg" px={{ base: 4, md: 6 }} pt={user ? 0 : 6} pb={{ base: 8, md: 12 }}>
        <ScannerPage
          loggedIn={Boolean(user)}
          initialTab={initialTab}
          initialEan={initialEan}
          features={{
            nfce: isInfosimplesEnabled(),
            label: isAiEnabled(),
            registration: isRegistrationOpen(),
          }}
        />
      </Container>
    </Box>
  );
}
