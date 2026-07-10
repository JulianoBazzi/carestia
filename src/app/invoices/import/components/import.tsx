'use client';

import {
  Card,
  Circle,
  Flex,
  Heading,
  HStack,
  Icon,
  Progress,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react';
import { strFromU8, unzipSync } from 'fflate';
import { useMemo, useRef, useState } from 'react';
import {
  LuCircleCheck,
  LuCircleX,
  LuCloudUpload,
  LuCopy,
  LuFileText,
  LuReceipt,
  LuStore,
  LuZap,
} from 'react-icons/lu';
import { StatusBadge } from '~/components/Badge/StatusBadge';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import {
  API_URL_INVOICES,
  TABLE_DASHBOARD_METRICS,
  TABLE_INFLATION,
  TABLE_INVOICES,
} from '~/config/constants';
import { api } from '~/services/apiClient';
import { queryClient } from '~/services/queryClient';

// Processa vários arquivos ao mesmo tempo (equilíbrio entre velocidade e carga).
const CONCURRENCY = 5;

type EntryStatus = 'queued' | 'processing' | 'imported' | 'duplicated' | 'error';

interface IImportResult {
  file: string;
  status: 'imported' | 'duplicated' | 'error';
  message?: string;
}

interface IImportResponse {
  summary: { imported: number; duplicated: number; errors: number };
  results: IImportResult[];
}

interface IEntry {
  id: string;
  name: string; // rótulo exibido (ex.: "notas.zip › nfe1.xml")
  sendName: string; // nome do arquivo enviado ao servidor (sempre .xml)
  xml: string;
  status: EntryStatus;
  message?: string;
}

const BADGE: Record<EntryStatus, { label: string; colorPalette: string }> = {
  queued: { label: 'Na fila', colorPalette: 'gray' },
  processing: { label: 'Processando', colorPalette: 'blue' },
  imported: { label: 'Importada', colorPalette: 'teal' },
  duplicated: { label: 'Duplicada', colorPalette: 'gray' },
  error: { label: 'Erro', colorPalette: 'red' },
};

function isZipFile(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith('.zip') ||
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed'
  );
}

/** Expande os arquivos escolhidos em XMLs individuais (descompacta .zip no navegador). */
async function expandToEntries(files: File[]): Promise<IEntry[]> {
  const entries: IEntry[] = [];
  const stamp = Date.now();
  let seq = 0;
  const nextId = () => `${stamp}-${seq++}`;

  for (const file of files) {
    if (!isZipFile(file)) {
      entries.push({
        id: nextId(),
        name: file.name,
        sendName: file.name,
        xml: await file.text(),
        status: 'queued',
      });
      continue;
    }

    try {
      const unzipped = unzipSync(new Uint8Array(await file.arrayBuffer()));
      const xmlNames = Object.keys(unzipped).filter((n) => n.toLowerCase().endsWith('.xml'));
      if (xmlNames.length === 0) {
        entries.push({
          id: nextId(),
          name: file.name,
          sendName: file.name,
          xml: '',
          status: 'error',
          message: 'Nenhum XML encontrado no .zip.',
        });
        continue;
      }
      for (const name of xmlNames) {
        const base = name.split('/').pop() ?? name;
        entries.push({
          id: nextId(),
          name: `${file.name} › ${base}`,
          sendName: base,
          xml: strFromU8(unzipped[name]),
          status: 'queued',
        });
      }
    } catch {
      entries.push({
        id: nextId(),
        name: file.name,
        sendName: file.name,
        xml: '',
        status: 'error',
        message: 'Falha ao ler o .zip.',
      });
    }
  }

  return entries;
}

/** Executa `worker` sobre `items` com no máximo `concurrency` em paralelo. */
async function runPool<T>(items: T[], worker: (item: T) => Promise<void>, concurrency: number) {
  let idx = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (idx < items.length) {
      await worker(items[idx++]);
    }
  });
  await Promise.all(runners);
}

function entryIcon(status: EntryStatus) {
  switch (status) {
    case 'imported':
      return { as: LuCircleCheck, color: 'teal.600' };
    case 'duplicated':
      return { as: LuCopy, color: 'fg.muted' };
    case 'error':
      return { as: LuCircleX, color: 'red.500' };
    default:
      return { as: LuFileText, color: 'fg.muted' };
  }
}

const SUPPORTED = [
  { icon: LuReceipt, code: 'NF-e', desc: 'Nota Fiscal Eletrônica (modelo 55) — produtos.' },
  { icon: LuStore, code: 'NFC-e', desc: 'Nota Fiscal de Consumidor (modelo 65) — varejo.' },
  { icon: LuZap, code: 'NF3e', desc: 'Conta de energia elétrica (modelo 66) — R$/kWh.' },
  {
    icon: LuFileText,
    code: 'NFS-e',
    desc: 'Nota Fiscal de Serviço Eletrônica — em breve.',
    comingSoon: true,
  },
];

export function InvoiceImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<IEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [running, setRunning] = useState(false);

  const stats = useMemo(() => {
    const done = entries.filter((e) => e.status !== 'queued' && e.status !== 'processing').length;
    return {
      total: entries.length,
      done,
      progress: entries.length ? Math.round((done / entries.length) * 100) : 0,
      imported: entries.filter((e) => e.status === 'imported').length,
      duplicated: entries.filter((e) => e.status === 'duplicated').length,
      errors: entries.filter((e) => e.status === 'error').length,
    };
  }, [entries]);

  function patch(id: string, data: Partial<IEntry>) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...data } : e)));
  }

  async function importEntry(entry: IEntry) {
    patch(entry.id, { status: 'processing' });
    try {
      const form = new FormData();
      form.append('file', new File([entry.xml], entry.sendName, { type: 'application/xml' }));
      const { data } = await api.post<IImportResponse>(`${API_URL_INVOICES}/import`, form);
      const result = data.results[0];
      patch(entry.id, {
        status: result?.status ?? 'error',
        message: result?.message,
      });
    } catch (e) {
      const message =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (e as Error).message;
      patch(entry.id, { status: 'error', message });
    }
  }

  async function processFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setRunning(true);
    setPreparing(true);
    setEntries([]);
    const expanded = await expandToEntries(files);
    setEntries(expanded);
    setPreparing(false);

    // Entradas já marcadas como erro (zip ilegível / sem XML) não vão ao servidor.
    await runPool(
      expanded.filter((e) => e.status === 'queued'),
      importEntry,
      CONCURRENCY,
    );

    setRunning(false);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [TABLE_INVOICES] }),
      queryClient.invalidateQueries({ queryKey: [TABLE_DASHBOARD_METRICS] }),
      queryClient.invalidateQueries({ queryKey: [TABLE_INFLATION] }),
    ]);
  }

  return (
    <Stack gap="6">
      <Stack gap="0.5">
        <Heading size="lg" fontFamily="heading">
          Importar por arquivo
        </Heading>
        <Text fontSize="sm" color="fg.muted">
          Arraste os XMLs (ou um .zip) das suas notas. Você baixa esses arquivos no portal da SEFAZ
          ou os recebe por e-mail.
        </Text>
      </Stack>

      <Card.Root
        borderWidth="2px"
        borderStyle="dashed"
        borderColor={dragging ? 'teal.500' : 'border'}
        bg={dragging ? 'teal.50' : 'bg.surface'}
        _dark={{ bg: dragging ? 'teal.950' : 'bg.surface' }}
        cursor="pointer"
        transition="all 0.15s"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
        }}
      >
        <Card.Body>
          <Stack align="center" gap="3" py="8" textAlign="center">
            <Circle size="14" bg="teal.50" color="teal.600" _dark={{ bg: 'teal.950' }}>
              <LuCloudUpload size={28} />
            </Circle>
            <Stack gap="1">
              <Text fontWeight="semibold" fontSize="lg">
                Arraste seus arquivos aqui
              </Text>
              <Text fontSize="sm" color="fg.muted">
                ou clique para selecionar do seu computador
              </Text>
            </Stack>
            <PrimaryButton
              size="sm"
              loading={running}
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              <LuCloudUpload /> Selecionar arquivos
            </PrimaryButton>
            <Text fontSize="xs" color="fg.muted">
              Formatos aceitos: XML e ZIP — vários arquivos de uma vez.
            </Text>
          </Stack>
          <input
            ref={inputRef}
            type="file"
            accept=".xml,.zip,text/xml,application/xml,application/zip"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) processFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </Card.Body>
      </Card.Root>

      {preparing && (
        <Card.Root bg="bg.surface">
          <Card.Body>
            <HStack gap="3">
              <Spinner size="sm" color="blue.500" />
              <Text fontSize="sm" color="fg.muted">
                Preparando arquivos…
              </Text>
            </HStack>
          </Card.Body>
        </Card.Root>
      )}

      {entries.length > 0 && (
        <Card.Root bg="bg.surface">
          <Card.Body>
            <Stack gap="4">
              <Flex justify="space-between" align="center" gap="3" wrap="wrap">
                <Text fontWeight="semibold">
                  {running ? 'Processando importação…' : 'Importação concluída'}
                </Text>
                <Text fontSize="sm" color="fg.muted">
                  {stats.done} de {stats.total}
                </Text>
              </Flex>
              <Progress.Root value={stats.progress} colorPalette="teal" size="sm">
                <Progress.Track>
                  <Progress.Range />
                </Progress.Track>
              </Progress.Root>
              <Text fontSize="xs" color="fg.muted">
                {stats.imported} importada(s) · {stats.duplicated} duplicada(s) · {stats.errors}{' '}
                erro(s)
              </Text>
              <Stack gap="2" maxH="20rem" overflowY="auto">
                {entries.map((entry) => {
                  const icon = entryIcon(entry.status);
                  const badge = BADGE[entry.status];
                  return (
                    <Flex
                      key={entry.id}
                      justify="space-between"
                      align="center"
                      gap="3"
                      borderWidth="1px"
                      borderRadius="lg"
                      p="3"
                    >
                      <HStack gap="2.5" minW="0">
                        {entry.status === 'processing' ? (
                          <Spinner size="sm" color="blue.500" flexShrink={0} />
                        ) : (
                          <Icon as={icon.as} color={icon.color} flexShrink={0} />
                        )}
                        <Stack gap="0" minW="0">
                          <Text fontSize="sm" fontWeight="medium" truncate>
                            {entry.name}
                          </Text>
                          {entry.status === 'error' && entry.message && (
                            <Text fontSize="xs" color="red.500">
                              {entry.message}
                            </Text>
                          )}
                        </Stack>
                      </HStack>
                      <StatusBadge
                        withDot={false}
                        label={badge.label}
                        colorPalette={badge.colorPalette}
                      />
                    </Flex>
                  );
                })}
              </Stack>
            </Stack>
          </Card.Body>
        </Card.Root>
      )}

      <Stack gap="3">
        <Text fontWeight="semibold" fontSize="sm">
          Documentos suportados
        </Text>
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap="3">
          {SUPPORTED.map((doc) => (
            <Card.Root key={doc.code} bg="bg.surface" opacity={doc.comingSoon ? 0.6 : 1}>
              <Card.Body>
                <HStack gap="3" align="start">
                  <Circle
                    size="9"
                    bg="teal.50"
                    color="teal.600"
                    _dark={{ bg: 'teal.950' }}
                    flexShrink={0}
                  >
                    <Icon as={doc.icon} boxSize={4} />
                  </Circle>
                  <Stack gap="0.5">
                    <HStack gap="1.5">
                      <Text fontWeight="semibold" fontSize="sm">
                        {doc.code}
                      </Text>
                      {doc.comingSoon && (
                        <StatusBadge withDot={false} label="Em breve" colorPalette="gray" />
                      )}
                    </HStack>
                    <Text fontSize="xs" color="fg.muted">
                      {doc.desc}
                    </Text>
                  </Stack>
                </HStack>
              </Card.Body>
            </Card.Root>
          ))}
        </SimpleGrid>
      </Stack>
    </Stack>
  );
}
