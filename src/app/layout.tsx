import type { Metadata, Viewport } from "next";
import { Provider } from "@/components/ui/provider";

export const metadata: Metadata = {
  applicationName: "Minha Inflação",
  title: {
    default: "Minha Inflação",
    template: "%s · Minha Inflação",
  },
  description: "Acompanhe a inflação do seu próprio bolso.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Minha Inflação",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a202c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
