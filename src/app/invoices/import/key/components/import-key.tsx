'use client';

import {
  Card,
  Flex,
  Heading,
  HStack,
  Icon,
  Progress,
  Stack,
  Text,
  Textarea,
} from '@chakra-ui/react';
import { useBeforeUnload } from '@julianobazzi/nextjs-utils';
import { useMemo, useState } from 'react';
import { LuInfo, LuKeyRound, LuTriangleAlert } from 'react-icons/lu';
import { StatusBadge } from '~/components/Badge/StatusBadge';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import {
  API_URL_INVOICES,
  TABLE_COMPANIES,
  TABLE_INFLATION,
  TABLE_INVOICES,
  TABLE_ITEMS,
  TABLE_PUBLIC_PRICES,
} from '~/config/constants';
import { api } from '~/services/apiClient';
import { type KeyImportUiStatus, keyImportStatusInfo } from '~/services/hooks/useInvoices';
import { queryClient } from '~/services/queryClient';

type KeyStatus = KeyImportUiStatus;

interface IKeyItem {
  key: string;
  status: KeyStatus;
  message?: string;
}

function extractKeys(text: string): string[] {
  const matches = text.match(/\d{44}/g) ?? [];
  return Array.from(new Set(matches));
}

export function InvoiceImportKey({ enabled }: { enabled: boolean }) {
  const [text, setText] = useState('');
  const [items, setItems] = useState<IKeyItem[]>([]);
  const [running, setRunning] = useState(false);

  // Consulta paga em andamento: avisa antes de fechar/recarregar a aba.
  useBeforeUnload(running, 'A importação ainda está em andamento. Deseja mesmo sair?');

  const parsedKeys = useMemo(() => extractKeys(text), [text]);
  const doneCount = items.filter((i) => i.status !== 'queued' && i.status !== 'consulting').length;
  const progress = items.length ? Math.round((doneCount / items.length) * 100) : 0;

  async function run() {
    const keys = extractKeys(text);
    if (keys.length === 0 || !enabled) {
      return;
    }

    const queued: IKeyItem[] = keys.map((key) => ({ key, status: 'queued' }));
    setItems(queued);
    setRunning(true);

    for (const item of queued) {
      setItems((prev) =>
        prev.map((p) => (p.key === item.key ? { ...p, status: 'consulting' } : p)),
      );
      try {
        const { data } = await api.post(`${API_URL_INVOICES}/import-key`, { keys: [item.key] });
        const result = data.results?.[0] ?? { status: 'error', message: 'Sem resposta.' };
        setItems((prev) =>
          prev.map((p) =>
            p.key === item.key ? { ...p, status: result.status, message: result.message } : p,
          ),
        );
      } catch (e) {
        const message =
          (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          (e as Error).message;
        setItems((prev) =>
          prev.map((p) => (p.key === item.key ? { ...p, status: 'error', message } : p)),
        );
      }
    }

    setRunning(false);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [TABLE_INVOICES] }),
      queryClient.invalidateQueries({ queryKey: [TABLE_INFLATION] }),
      // A importação cria itens/empresas no catálogo global e novas amostras.
      queryClient.invalidateQueries({ queryKey: [TABLE_ITEMS] }),
      queryClient.invalidateQueries({ queryKey: [TABLE_COMPANIES] }),
      queryClient.invalidateQueries({ queryKey: [TABLE_PUBLIC_PRICES] }),
    ]);
  }

  return (
    <Stack gap="6">
      <Stack gap="0.5">
        <Heading size="lg" fontFamily="heading">
          Importar por chave de acesso
        </Heading>
        <Text fontSize="sm" color="fg.muted">
          Cole as chaves de acesso (44 dígitos) das suas notas. Consultamos e baixamos a nota
          automaticamente via SEFAZ.
        </Text>
      </Stack>

      {!enabled && (
        <Card.Root bg="orange.50" borderColor="orange.200" _dark={{ bg: 'orange.950' }}>
          <Card.Body>
            <HStack gap="3" align="start">
              <Icon as={LuTriangleAlert} color="orange.500" boxSize={5} mt={0.5} />
              <Stack gap="0.5">
                <Text fontWeight="semibold" fontSize="sm">
                  Integração ainda não configurada
                </Text>
                <Text fontSize="sm" color="fg.muted">
                  A consulta por chave usa a API Infosimples. Defina a variável de ambiente{' '}
                  <Text as="span" fontFamily="mono">
                    INFOSIMPLES_TOKEN
                  </Text>{' '}
                  para habilitar este recurso.
                </Text>
              </Stack>
            </HStack>
          </Card.Body>
        </Card.Root>
      )}

      <Card.Root bg="bg.surface">
        <Card.Body>
          <Stack gap="3">
            <Textarea
              placeholder={'Cole uma chave por linha:\n5126...\n3526...'}
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              fontFamily="mono"
              fontSize="sm"
            />
            <Flex justify="space-between" align="center" gap="3" wrap="wrap">
              <HStack gap="1.5" color="fg.muted">
                <Icon as={LuInfo} boxSize={4} />
                <Text fontSize="xs">{parsedKeys.length} chave(s) válida(s) detectada(s).</Text>
              </HStack>
              <PrimaryButton
                size="sm"
                loading={running}
                disabled={!enabled || parsedKeys.length === 0}
                onClick={run}
              >
                <LuKeyRound /> Consultar e importar
              </PrimaryButton>
            </Flex>
          </Stack>
        </Card.Body>
      </Card.Root>

      {items.length > 0 && (
        <Card.Root bg="bg.surface">
          <Card.Body>
            <Stack gap="4">
              <Flex justify="space-between" align="center" gap="3" wrap="wrap">
                <Text fontWeight="semibold">
                  {running ? 'Consultando chaves na SEFAZ…' : 'Consulta concluída'}
                </Text>
                <Text fontSize="sm" color="fg.muted">
                  {doneCount} de {items.length}
                </Text>
              </Flex>
              <Progress.Root value={progress} colorPalette="teal" size="sm">
                <Progress.Track>
                  <Progress.Range />
                </Progress.Track>
              </Progress.Root>
              <Stack gap="2">
                {items.map((item) => (
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
                      <Text fontSize="sm" fontFamily="mono" truncate>
                        {item.key}
                      </Text>
                      {item.message && (
                        <Text fontSize="xs" color="fg.muted" truncate>
                          {item.message}
                        </Text>
                      )}
                    </Stack>
                    <StatusBadge
                      withDot={false}
                      label={keyImportStatusInfo(item.status).label}
                      colorPalette={keyImportStatusInfo(item.status).colorPalette}
                    />
                  </Flex>
                ))}
              </Stack>
            </Stack>
          </Card.Body>
        </Card.Root>
      )}
    </Stack>
  );
}
