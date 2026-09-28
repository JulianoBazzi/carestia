'use client';

import { Box, Button, Card, HStack, Icon, Skeleton, Stack, Text } from '@chakra-ui/react';
import type { IDetectedBarcode, IScannerError, ScannerErrorKind } from '@yudiel/react-qr-scanner';
import type { BarcodeFormat } from 'barcode-detector';
import dynamic from 'next/dynamic';
import { type ReactNode, useRef, useState } from 'react';
import { LuCameraOff, LuScanLine } from 'react-icons/lu';

// A lib toca `navigator`/`window` no carregamento → só no client. O import de
// tipos acima é apagado no build e não puxa o módulo no servidor.
const Scanner = dynamic(() => import('@yudiel/react-qr-scanner').then((m) => m.Scanner), {
  ssr: false,
  loading: () => <Skeleton w="full" aspectRatio={1} borderRadius="xl" />,
});

/** Ignora a releitura do mesmo código por este intervalo (câmera parada no produto). */
const DEDUPE_MS = 2500;

const ERROR_TEXT: Partial<Record<ScannerErrorKind, string>> = {
  'permission-denied':
    'Acesso à câmera negado. Libere a câmera para este site nas configurações do navegador e recarregue a página.',
  'insecure-context': 'A câmera só funciona em conexão segura (HTTPS).',
  'no-camera': 'Nenhuma câmera encontrada neste aparelho.',
  unsupported: 'Este navegador não dá acesso à câmera.',
  'in-use': 'A câmera está em uso por outro aplicativo. Feche-o e tente de novo.',
};

export interface ICameraScannerProps {
  formats: BarcodeFormat[];
  /** Chamado uma vez por código lido (com dedupe). */
  onDetected: (code: { rawValue: string; format: string }) => void;
  /** Congela a câmera (ex.: enquanto mostra o resultado). */
  paused: boolean;
  onResume: () => void;
  /** Texto de apoio sob o visor. */
  hint?: string;
  /** Conteúdo do overlay quando pausado (padrão: botão "Escanear novamente"). */
  pausedContent?: ReactNode;
}

/**
 * Visor de câmera para leitura de código de barras / QR code. Usa a câmera
 * traseira, mostra o estado de erro em português e oferece "ler de novo" quando
 * pausado. Cada aba do scanner tem sempre um caminho manual ao lado — a câmera
 * pode faltar, ser negada ou estar em HTTP.
 */
export function CameraScanner({
  formats,
  onDetected,
  paused,
  onResume,
  hint,
  pausedContent,
}: ICameraScannerProps) {
  const [error, setError] = useState<IScannerError | null>(null);
  // Remonta o <Scanner> no "Tentar de novo": pede a câmera outra vez (ex.:
  // depois de fechar o app que a estava usando).
  const [attempt, setAttempt] = useState(0);
  const last = useRef<{ value: string; at: number } | null>(null);

  function retry() {
    setError(null);
    setAttempt((n) => n + 1);
  }

  function handleScan(codes: IDetectedBarcode[]) {
    const code = codes[0];
    if (!code?.rawValue) {
      return;
    }
    const now = Date.now();
    if (last.current && last.current.value === code.rawValue && now - last.current.at < DEDUPE_MS) {
      return;
    }
    last.current = { value: code.rawValue, at: now };
    onDetected({ rawValue: code.rawValue, format: code.format });
  }

  if (error) {
    return (
      <Card.Root bg="bg.surface">
        <Card.Body>
          <HStack gap="3" align="start">
            <Icon as={LuCameraOff} color="orange.500" boxSize={5} mt={0.5} />
            <Stack gap="0.5">
              <Text fontWeight="semibold" fontSize="sm">
                Câmera indisponível
              </Text>
              <Text fontSize="sm" color="fg.muted">
                {ERROR_TEXT[error.kind] ?? 'Não foi possível iniciar a câmera.'} Você pode digitar o
                código abaixo.
              </Text>
              {error.kind !== 'insecure-context' && error.kind !== 'unsupported' && (
                <Button size="xs" variant="outline" mt="2" alignSelf="start" onClick={retry}>
                  Tentar de novo
                </Button>
              )}
            </Stack>
          </HStack>
        </Card.Body>
      </Card.Root>
    );
  }

  return (
    <Stack gap="2">
      <Box position="relative" borderRadius="xl" overflow="hidden" bg="black">
        <Scanner
          key={attempt}
          onScan={handleScan}
          onError={setError}
          formats={formats}
          paused={paused}
          constraints={{ facingMode: 'environment' }}
          allowMultiple={false}
          sound={false}
          components={{ finder: true, torch: true }}
          styles={{ container: { width: '100%', aspectRatio: '1 / 1' } }}
        />
        {paused && (
          <Stack
            position="absolute"
            inset="0"
            align="center"
            justify="center"
            bg="blackAlpha.700"
            gap="3"
          >
            {pausedContent ?? (
              <Button size="sm" colorPalette="teal" onClick={onResume}>
                <LuScanLine /> Escanear novamente
              </Button>
            )}
          </Stack>
        )}
      </Box>
      {hint && (
        <Text fontSize="xs" color="fg.muted" textAlign="center">
          {hint}
        </Text>
      )}
    </Stack>
  );
}
