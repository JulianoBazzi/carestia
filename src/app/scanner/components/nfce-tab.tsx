'use client';

import { Button, Card, Flex, HStack, Input, Spinner, Stack, Text } from '@chakra-ui/react';
import { useBeforeUnload } from '@julianobazzi/nextjs-utils';
import NextLink from 'next/link';
import { useRef, useState } from 'react';
import { LuKeyRound, LuReceipt } from 'react-icons/lu';
import { CameraScanner } from '~/app/scanner/components/camera-scanner';
import { FeatureUnavailable, LoginGate } from '~/app/scanner/components/login-gate';
import { StatusBadge } from '~/components/Badge/StatusBadge';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import {
  API_URL_INVOICES,
  TABLE_INFLATION,
  TABLE_INVOICES,
  TABLE_PUBLIC_PRICES,
} from '~/config/constants';
import { useFeedback } from '~/contexts/FeedbackContext';
import { extractAccessKey } from '~/lib/access-key';
import { apiErrorMessage } from '~/lib/api-error';
import { api } from '~/services/apiClient';
import { type KeyImportUiStatus, keyImportStatusInfo } from '~/services/hooks/useInvoices';
import { queryClient } from '~/services/queryClient';

interface IScannedKey {
  key: string;
  status: KeyImportUiStatus;
  message?: string;
}

interface INfceTabProps {
  loggedIn: boolean;
  /** `INFOSIMPLES_TOKEN` configurado no servidor. */
  enabled: boolean;
  registrationOpen: boolean;
}

/**
 * Aba "Cupom": lê o QR code da NFC-e (ou o código de barras da chave), extrai a
 * chave de acesso e importa a nota automaticamente. A consulta é paga e tem
 * cota diária por usuário — reler um cupom já importado não consome cota.
 */
export function NfceTab({ loggedIn, enabled, registrationOpen }: INfceTabProps) {
  const { warningFeedbackToast } = useFeedback();
  const [items, setItems] = useState<IScannedKey[]>([]);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState('');
  // Espelho síncrono: o `onDetected` pode disparar antes do re-render.
  const seen = useRef(new Set<string>());

  useBeforeUnload(busy, 'A importação ainda está em andamento. Deseja mesmo sair?');

  if (!loggedIn) {
    return (
      <Stack pt="2">
        <LoginGate tab="nfce" registrationOpen={registrationOpen}>
          Entre na sua conta para importar o cupom fiscal pelo QR code — os produtos e preços entram
          direto no seu índice de inflação.
        </LoginGate>
      </Stack>
    );
  }

  if (!enabled) {
    return (
      <Stack pt="2">
        <FeatureUnavailable>
          A importação pelo QR code está indisponível no momento. Você ainda pode importar o XML da
          nota em Notas Fiscais.
        </FeatureUnavailable>
      </Stack>
    );
  }

  function update(key: string, patch: Partial<IScannedKey>) {
    setItems((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  async function importKey(key: string) {
    seen.current.add(key);
    // Retry da mesma chave substitui a linha (uma key React por chave de acesso).
    setItems((prev) => [{ key, status: 'consulting' }, ...prev.filter((p) => p.key !== key)]);
    setBusy(true);
    try {
      const { data } = await api.post(`${API_URL_INVOICES}/import-key`, { keys: [key] });
      const result = data.results?.[0] ?? { status: 'error', message: 'Sem resposta.' };
      update(key, { status: result.status, message: result.message });
      if (result.status === 'imported') {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: [TABLE_INVOICES] }),
          queryClient.invalidateQueries({ queryKey: [TABLE_INFLATION] }),
          queryClient.invalidateQueries({ queryKey: [TABLE_PUBLIC_PRICES] }),
        ]);
      }
    } catch (e) {
      update(key, { status: 'error', message: apiErrorMessage(e) });
      // Erro de transporte/cota: deixa tentar de novo a mesma chave.
      seen.current.delete(key);
    } finally {
      setBusy(false);
    }
  }

  function handleText(text: string): boolean {
    const extracted = extractAccessKey(text);
    if (extracted.error !== undefined) {
      warningFeedbackToast('Código não reconhecido', extracted.error);
      return false;
    }
    if (seen.current.has(extracted.key)) {
      warningFeedbackToast('Cupom já lido', 'Este cupom já foi processado nesta sessão.');
      return false;
    }
    void importKey(extracted.key);
    return true;
  }

  return (
    <Stack gap="4" pt="2">
      <CameraScanner
        formats={['qr_code', 'code_128']}
        paused={busy}
        onResume={() => undefined}
        pausedContent={
          <HStack gap="2" color="white">
            <Spinner size="sm" />
            <Text fontSize="sm" fontWeight="semibold">
              Consultando a nota na SEFAZ…
            </Text>
          </HStack>
        }
        onDetected={(code) => {
          if (!busy) {
            handleText(code.rawValue);
          }
        }}
        hint="Aponte para o QR code impresso no cupom fiscal (NFC-e)."
      />

      <Card.Root bg="bg.surface" size="sm">
        <Card.Body>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (handleText(typed)) {
                setTyped('');
              }
            }}
          >
            <Flex gap="2" align="end">
              <Stack gap="1" flex="1">
                <Text fontSize="xs" fontWeight="semibold" color="fg.muted">
                  Ou cole a chave de acesso (44 dígitos)
                </Text>
                <Input
                  name="access-key"
                  inputMode="numeric"
                  autoComplete="off"
                  fontFamily="mono"
                  fontSize="sm"
                  placeholder="4326…"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                />
              </Stack>
              <PrimaryButton type="submit" loading={busy} disabled={typed.trim().length < 44}>
                <LuKeyRound /> Importar
              </PrimaryButton>
            </Flex>
          </form>
        </Card.Body>
      </Card.Root>

      {items.length > 0 && (
        <Card.Root bg="bg.surface">
          <Card.Body>
            <Stack gap="3">
              <Flex justify="space-between" align="center" gap="3">
                <Text fontWeight="semibold">Cupons lidos</Text>
                <Button size="xs" variant="ghost" asChild>
                  <NextLink href="/invoices">
                    <LuReceipt /> Ver minhas notas
                  </NextLink>
                </Button>
              </Flex>
              {items.map((item) => {
                const badge = keyImportStatusInfo(item.status);
                return (
                  <Flex
                    key={item.key}
                    justify="space-between"
                    align="center"
                    gap="3"
                    borderWidth="1px"
                    borderRadius="lg"
                    p="3"
                  >
                    <Stack gap="0" minW="0">
                      <Text fontSize="xs" fontFamily="mono" truncate>
                        {item.key}
                      </Text>
                      {item.message && (
                        <Text fontSize="xs" color="fg.muted">
                          {item.message}
                        </Text>
                      )}
                    </Stack>
                    <StatusBadge
                      withDot={false}
                      label={badge.label}
                      colorPalette={badge.colorPalette}
                    />
                  </Flex>
                );
              })}
            </Stack>
          </Card.Body>
        </Card.Root>
      )}
    </Stack>
  );
}
