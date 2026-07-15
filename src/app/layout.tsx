import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { Provider } from '~/components/ui/provider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-head',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://carestia.com.br'),
  applicationName: 'Carestia',
  title: {
    default: 'Carestia',
    template: '%s · Carestia',
  },
  description: 'Acompanhe a inflação do seu próprio bolso.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Carestia',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://carestia.com.br',
    siteName: 'Carestia',
    title: 'Carestia',
    description: 'Acompanhe a inflação do seu próprio bolso.',
  },
  twitter: {
    card: 'summary',
    title: 'Carestia',
    description: 'Acompanhe a inflação do seu próprio bolso.',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0D9488' },
    { media: '(prefers-color-scheme: dark)', color: '#111111' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${jakarta.variable}`} suppressHydrationWarning>
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
