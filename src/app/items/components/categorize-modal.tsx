'use client';

import {
  Circle,
  Dialog,
  Flex,
  HStack,
  Icon,
  Portal,
  Progress,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react';
import { type Ref, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { LuCircleCheck, LuCircleX, LuClock, LuSparkles } from 'react-icons/lu';
import { StatusBadge } from '~/components/Badge/StatusBadge';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import { SecondaryButton } from '~/components/Button/Base/SecondaryButton';
import { StatCard } from '~/components/StatCard';
import { TABLE_ITEMS } from '~/config/constants';
import { api } from '~/services/apiClient';
import { queryClient } from '~/services/queryClient';

// Lote pequeno: dá sensação de "registro a registro" sem 1 request por item.
const BATCH_LIMIT = 5;

interface IResult {
  id: string;
  name: string;
  category: string | null;
  status: 'categorized' | 'failed';
}

interface ICategorizeResponse {
  data: {
    processed: number;
    categorized: number;
    failed: number;
    remaining: number;
    results: IResult[];
  };
}

export type CategorizeModalHandle = { open: () => void };

export function CategorizeModal({ ref }: { ref?: Ref<CategorizeModalHandle> }) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<IResult[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef(false);
  const runningRef = useRef(false);

  const start = useCallback(async () => {
    if (runningRef.current) {
      return;
    }
    runningRef.current = true;
    stopRef.current = false;
    setRunning(true);
    setResults([]);
    setTotal(0);
    setError(null);

    let known = 0; // total conhecido = processados + remaining da 1ª resposta

    try {
      while (!stopRef.current) {
        const response = await api.post<ICategorizeResponse>('/api/items/categorize', {
          limit: BATCH_LIMIT,
        });
        const r = response.data.data;
        if (known === 0) {
          known = r.processed + r.remaining;
          setTotal(known);
        }
        setResults((prev) => [...prev, ...r.results]);
        if (r.processed === 0 || r.remaining === 0) {
          break;
        }
      }
    } catch (e) {
      const message =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (e as Error).message;
      setError(message);
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      open() {
        setOpen(true);
        void start();
      },
    }),
    [start],
  );

  const close = useCallback(() => {
    setOpen(false);
    void queryClient.invalidateQueries({ queryKey: [TABLE_ITEMS] });
  }, []);

  const done = results.length;
  const categorized = results.filter((r) => r.status === 'categorized').length;
  const failed = done - categorized;
  const remaining = Math.max(0, total - done);
  const progress = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : running ? 0 : 100;

  const subtitle = running
    ? 'Classificando itens sem categoria…'
    : done > 0
      ? 'Concluído'
      : 'Itens sem categoria';
  const statusLabel = running ? 'Processando…' : done > 0 ? 'Concluído' : 'Pronto';

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(d) => {
        // Não deixa fechar enquanto processa (usar "Parar").
        if (running) {
          return;
        }
        if (!d.open) {
          close();
        }
      }}
      placement="center"
      closeOnInteractOutside={!running}
      closeOnEscape={!running}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="2xl">
            <Dialog.Header>
              <HStack gap="3">
                <Circle
                  size="10"
                  bg="teal.subtle"
                  color="teal.fg"
                  colorPalette="teal"
                  flexShrink={0}
                >
                  <Icon as={LuSparkles} boxSize={5} />
                </Circle>
                <Stack gap="0">
                  <Dialog.Title fontSize="lg" fontFamily="heading">
                    Categorizar com IA
                  </Dialog.Title>
                  <Text fontSize="xs" color="fg.muted">
                    {subtitle}
                  </Text>
                </Stack>
              </HStack>
            </Dialog.Header>

            <Dialog.Body>
              <Stack gap="5">
                <Stack gap="2">
                  <HStack justify="space-between" gap="3">
                    <HStack gap="2" color="fg.muted">
                      {running && <Spinner size="xs" color="teal.500" />}
                      <Text fontSize="sm" fontWeight="medium" color="fg">
                        {statusLabel}
                      </Text>
                    </HStack>
                    <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums">
                      {done}
                      {total ? ` / ${total} · ${progress}%` : ''}
                    </Text>
                  </HStack>
                  <Progress.Root value={progress} colorPalette="teal" size="sm">
                    <Progress.Track borderRadius="full">
                      <Progress.Range borderRadius="full" />
                    </Progress.Track>
                  </Progress.Root>
                </Stack>

                <SimpleGrid columns={{ base: 1, sm: 3 }} gap="3">
                  <StatCard
                    label="Categorizados"
                    value={categorized}
                    icon={<LuCircleCheck />}
                    colorPalette="teal"
                  />
                  <StatCard
                    label="Não classif."
                    value={failed}
                    icon={<LuCircleX />}
                    colorPalette="gray"
                  />
                  <StatCard
                    label="Restantes"
                    value={remaining}
                    icon={<LuClock />}
                    colorPalette="blue"
                  />
                </SimpleGrid>

                {error && (
                  <HStack
                    colorPalette="red"
                    bg="colorPalette.subtle"
                    color="colorPalette.fg"
                    borderRadius="lg"
                    p="3"
                    gap="2"
                    align="start"
                  >
                    <Icon as={LuCircleX} boxSize={4} flexShrink={0} mt="0.5" />
                    <Text fontSize="sm">{error}</Text>
                  </HStack>
                )}

                {done === 0 && !running && !error ? (
                  <Stack align="center" gap="2" py="6" color="fg.muted">
                    <Icon as={LuSparkles} boxSize={6} />
                    <Text fontSize="sm">Nada para categorizar.</Text>
                  </Stack>
                ) : (
                  <Stack gap="2" maxH="18rem" overflowY="auto" pr="1">
                    {results.map((r) => {
                      const ok = r.status === 'categorized';
                      return (
                        <Flex
                          key={r.id}
                          justify="space-between"
                          align="center"
                          gap="3"
                          borderWidth="1px"
                          borderColor="border"
                          borderRadius="lg"
                          px="3"
                          py="2.5"
                          transition="background 0.15s"
                          _hover={{ bg: 'bg.muted' }}
                        >
                          <HStack gap="2.5" minW="0">
                            <Circle
                              size="7"
                              colorPalette={ok ? 'teal' : 'red'}
                              bg="colorPalette.subtle"
                              color="colorPalette.fg"
                              flexShrink={0}
                            >
                              <Icon as={ok ? LuCircleCheck : LuCircleX} boxSize={3.5} />
                            </Circle>
                            <Text fontSize="sm" fontWeight="medium" truncate>
                              {r.name}
                            </Text>
                          </HStack>
                          <StatusBadge
                            withDot={false}
                            label={r.category ?? 'não classificado'}
                            colorPalette={ok ? 'blue' : 'gray'}
                            flexShrink={0}
                          />
                        </Flex>
                      );
                    })}
                    {running && (
                      <HStack gap="2.5" px="3" py="2.5" color="fg.muted">
                        <Spinner size="sm" color="teal.500" flexShrink={0} />
                        <Text fontSize="sm">Processando…</Text>
                      </HStack>
                    )}
                  </Stack>
                )}
              </Stack>
            </Dialog.Body>

            <Dialog.Footer gap="2">
              {running ? (
                <SecondaryButton
                  onClick={() => {
                    stopRef.current = true;
                  }}
                >
                  Parar
                </SecondaryButton>
              ) : (
                <PrimaryButton onClick={close}>Fechar</PrimaryButton>
              )}
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
