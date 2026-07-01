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
import { useRef, useState } from 'react';
import {
  LuCircleCheck,
  LuCircleX,
  LuCloudUpload,
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

type FileStatus = 'queued' | 'processing' | 'done' | 'error';

interface IImportSummary {
  imported: number;
  duplicated: number;
  errors: number;
}

interface IFileItem {
  id: string;
  name: string;
  file: File;
  status: FileStatus;
  summary?: IImportSummary;
  error?: string;
}

const SUPPORTED = [
  { icon: LuReceipt, code: 'NF-e', desc: 'Nota Fiscal Eletrônica (modelo 55) — produtos.' },
  { icon: LuStore, code: 'NFC-e', desc: 'Nota Fiscal de Consumidor (modelo 65) — varejo.' },
  { icon: LuFileText, code: 'NFS-e', desc: 'Nota Fiscal de Serviço Eletrônica nacional.' },
  { icon: LuZap, code: 'NF3e', desc: 'Conta de energia elétrica (modelo 66) — R$/kWh.' },
];

function statusBadge(item: IFileItem) {
  switch (item.status) {
    case 'queued':
      return <StatusBadge withDot={false} label="Na fila" colorPalette="gray" />;
    case 'processing':
      return <StatusBadge withDot={false} label="Processando" colorPalette="blue" />;
    case 'error':
      return <StatusBadge withDot={false} label="Erro" colorPalette="red" />;
    default: {
      const s = item.summary;
      if (s && s.errors > 0)
        return <StatusBadge withDot={false} label="Com erros" colorPalette="orange" />;
      if (s && s.duplicated > 0 && s.imported === 0)
        return <StatusBadge withDot={false} label="Duplicada" colorPalette="gray" />;
      return <StatusBadge withDot={false} label="Concluído" colorPalette="teal" />;
    }
  }
}

export function InvoiceImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<IFileItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);

  const doneCount = items.filter((i) => i.status === 'done' || i.status === 'error').length;
  const progress = items.length ? Math.round((doneCount / items.length) * 100) : 0;

  async function processFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const queued: IFileItem[] = files.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${file.name}`,
      name: file.name,
      file,
      status: 'queued',
    }));
    setItems(queued);
    setRunning(true);

    for (const item of queued) {
      setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: 'processing' } : p)));
      try {
        const form = new FormData();
        form.append('file', item.file);
        const { data } = await api.post<{ summary: IImportSummary }>(
          `${API_URL_INVOICES}/import`,
          form,
        );
        setItems((prev) =>
          prev.map((p) => (p.id === item.id ? { ...p, status: 'done', summary: data.summary } : p)),
        );
      } catch (e) {
        const message =
          (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          (e as Error).message;
        setItems((prev) =>
          prev.map((p) => (p.id === item.id ? { ...p, status: 'error', error: message } : p)),
        );
      }
    }

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

      {items.length > 0 && (
        <Card.Root bg="bg.surface">
          <Card.Body>
            <Stack gap="4">
              <Flex justify="space-between" align="center" gap="3" wrap="wrap">
                <Text fontWeight="semibold">
                  {running ? 'Processando importação…' : 'Importação concluída'}
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
                    key={item.id}
                    justify="space-between"
                    align="center"
                    gap="3"
                    borderWidth="1px"
                    borderRadius="lg"
                    p="3"
                  >
                    <HStack gap="2.5" minW="0">
                      {item.status === 'processing' ? (
                        <Spinner size="sm" color="blue.500" />
                      ) : (
                        <Icon
                          as={
                            item.status === 'error'
                              ? LuCircleX
                              : item.status === 'done'
                                ? LuCircleCheck
                                : LuFileText
                          }
                          color={
                            item.status === 'error'
                              ? 'red.500'
                              : item.status === 'done'
                                ? 'teal.600'
                                : 'fg.muted'
                          }
                        />
                      )}
                      <Stack gap="0" minW="0">
                        <Text fontSize="sm" fontWeight="medium" truncate>
                          {item.name}
                        </Text>
                        {item.status === 'done' && item.summary && (
                          <Text fontSize="xs" color="fg.muted">
                            {item.summary.imported} importada(s) · {item.summary.duplicated}{' '}
                            duplicada(s) · {item.summary.errors} erro(s)
                          </Text>
                        )}
                        {item.status === 'error' && (
                          <Text fontSize="xs" color="red.500" truncate>
                            {item.error}
                          </Text>
                        )}
                      </Stack>
                    </HStack>
                    {statusBadge(item)}
                  </Flex>
                ))}
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
            <Card.Root key={doc.code} bg="bg.surface">
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
                    <Text fontWeight="semibold" fontSize="sm">
                      {doc.code}
                    </Text>
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
