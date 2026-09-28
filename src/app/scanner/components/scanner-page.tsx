'use client';

import { Heading, Stack, Tabs, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { LuBarcode, LuQrCode, LuTag } from 'react-icons/lu';
import { BarcodeTab } from '~/app/scanner/components/barcode-tab';
import { LabelTab } from '~/app/scanner/components/label-tab';
import { NfceTab } from '~/app/scanner/components/nfce-tab';
import { useUserLocation } from '~/services/hooks/useUserLocation';

export type ScannerTab = 'barcode' | 'label' | 'nfce';

export interface IScannerFeatures {
  /** `INFOSIMPLES_TOKEN` configurado — habilita a importação pelo QR da NFC-e. */
  nfce: boolean;
  /** `OPENAI_API_KEY` configurado — habilita a leitura de etiqueta. */
  label: boolean;
  /** `REGISTRATION_OPEN=true` — mostra o link de "Criar conta" nos avisos de login. */
  registration: boolean;
}

interface IScannerPageProps {
  loggedIn: boolean;
  initialTab: ScannerTab;
  /** EAN vindo da URL (retorno do login) para pré-preencher a aba de etiqueta. */
  initialEan?: string | null;
  features: IScannerFeatures;
}

export function ScannerPage({ loggedIn, initialTab, initialEan, features }: IScannerPageProps) {
  const [tab, setTab] = useState<ScannerTab>(initialTab);
  // EAN que a aba de código de barras não achou no catálogo e o usuário quer
  // cadastrar pela etiqueta.
  const [pendingEan, setPendingEan] = useState<string | null>(initialEan ?? null);
  // Uma região só para as abas que comparam preço.
  const userLocation = useUserLocation();

  function changeTab(next: ScannerTab) {
    setTab(next);
    // Mantém a aba na URL (voltar do login, compartilhar) sem `useSearchParams`,
    // que exigiria um limite de Suspense só para isso.
    window.history.replaceState(null, '', `?tab=${next}`);
  }

  return (
    <Stack gap="5">
      <Stack gap="0.5">
        <Heading size="lg" fontFamily="heading">
          Scanner
        </Heading>
        <Text fontSize="sm" color="fg.muted">
          Consulte o preço de um produto, registre o preço da gôndola ou importe o cupom pelo QR
          code.
        </Text>
      </Stack>

      {/* lazyMount + unmountOnExit: só a aba ativa existe, então só uma câmera fica ligada. */}
      <Tabs.Root
        value={tab}
        onValueChange={(e) => changeTab(e.value as ScannerTab)}
        lazyMount
        unmountOnExit
        fitted
        variant="enclosed"
        colorPalette="teal"
      >
        <Tabs.List>
          <Tabs.Trigger value="barcode">
            <LuBarcode /> Preço
          </Tabs.Trigger>
          <Tabs.Trigger value="label">
            <LuTag /> Etiqueta
          </Tabs.Trigger>
          <Tabs.Trigger value="nfce">
            <LuQrCode /> Cupom
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="barcode" px="0">
          <BarcodeTab
            loggedIn={loggedIn}
            userLocation={userLocation}
            onRegisterLabel={(ean) => {
              setPendingEan(ean);
              changeTab('label');
            }}
          />
        </Tabs.Content>
        <Tabs.Content value="label" px="0">
          <LabelTab
            loggedIn={loggedIn}
            enabled={features.label}
            registrationOpen={features.registration}
            userLocation={userLocation}
            initialEan={pendingEan}
          />
        </Tabs.Content>
        <Tabs.Content value="nfce" px="0">
          <NfceTab
            loggedIn={loggedIn}
            enabled={features.nfce}
            registrationOpen={features.registration}
          />
        </Tabs.Content>
      </Tabs.Root>
    </Stack>
  );
}
