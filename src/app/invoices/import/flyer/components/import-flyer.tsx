'use client';

import {
  Box,
  Button,
  Card,
  Checkbox,
  Flex,
  Heading,
  HStack,
  Icon,
  Image,
  Input,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useBeforeUnload } from '@julianobazzi/nextjs-utils';
import { useRef, useState } from 'react';
import { LuCopy, LuImagePlus, LuSave, LuTrash2, LuTriangleAlert } from 'react-icons/lu';
import { StatusBadge } from '~/components/Badge/StatusBadge';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import { Select } from '~/components/Form/Select';
import { SelectWithService } from '~/components/Form/SelectWithService';
import {
  API_URL_FLYERS_OBSERVATIONS,
  API_URL_FLYERS_READ,
  TABLE_ITEMS,
  TABLE_PUBLIC_PRICES,
} from '~/config/constants';
import { useFeedback } from '~/contexts/FeedbackContext';
import { parsePrice, toDateInputValue } from '~/lib/format';
import { downscaleToJpeg, loadImage } from '~/lib/image';
import { UFS } from '~/lib/ufs';
import type IItemAPI from '~/models/Entity/Item/IItemAPI';
import { api } from '~/services/apiClient';
import { getItems } from '~/services/hooks/useItems';
import { queryClient } from '~/services/queryClient';

const UF_OPTIONS = UFS.map((uf) => ({ value: uf, label: uf }));
const PRODUCT_ONLY = { type: 'product' };
/** Encarte tem letra miúda: resolução maior que a da etiqueta (1280). */
const FLYER_MAX_SIDE = 2048;

interface ISuggestion {
  id: string;
  name: string;
  unit: string | null;
  similarity: number;
  samePack: boolean;
}

/** Resposta de `POST /api/flyers/read`. */
interface IFlyerReadResponse {
  store: string | null;
  valid_from: string | null;
  valid_until: string | null;
  region_text: string | null;
  state: string | null;
  cities: string[];
  items: {
    name: string;
    unit: string | null;
    price: number;
    regular_price: number | null;
    condition: string | null;
    all_variants: boolean;
    suggestions: ISuggestion[];
    match_id: string | null;
  }[];
}

interface ISaveResult {
  created: number;
  skipped: number;
  failed: { name: string; message: string }[];
}

/** Item escolhido no catálogo — o select só precisa de id/nome. */
type CatalogItem = Pick<IItemAPI, 'id' | 'name' | 'unit'>;

interface IRow {
  key: string;
  checked: boolean;
  name: string;
  unit: string;
  price: string;
  regular: string;
  condition: string | null;
  allVariants: boolean;
  suggestions: ISuggestion[];
  item: CatalogItem | null;
}

type FlyerStatus = 'queued' | 'reading' | 'ready' | 'saving' | 'saved' | 'error';

interface IFlyer {
  key: string;
  fileName: string;
  thumb: string;
  status: FlyerStatus;
  message?: string;
  store: string | null;
  regionText: string | null;
  validUntil: string | null;
  observedAt: string;
  state: string;
  cities: string;
  rows: IRow[];
}

const STATUS_INFO: Record<FlyerStatus, { label: string; colorPalette: string }> = {
  queued: { label: 'Na fila', colorPalette: 'gray' },
  reading: { label: 'Lendo…', colorPalette: 'blue' },
  ready: { label: 'Revisar', colorPalette: 'orange' },
  saving: { label: 'Gravando…', colorPalette: 'blue' },
  saved: { label: 'Gravado', colorPalette: 'green' },
  error: { label: 'Erro', colorPalette: 'red' },
};

function priceText(value: number | null): string {
  return value === null ? '' : value.toFixed(2).replace('.', ',');
}

function errorMessage(e: unknown): string {
  return (
    (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
    (e as Error).message
  );
}

function rowsFromReading(reading: IFlyerReadResponse, flyerKey: string): IRow[] {
  return reading.items.map((it, i) => {
    const match = it.match_id ? it.suggestions.find((s) => s.id === it.match_id) : undefined;
    return {
      key: `${flyerKey}-${i}`,
      // Preço com condição ("leve 4 pague 3") não é o de uma unidade avulsa.
      checked: !it.condition,
      name: it.name,
      unit: it.unit ?? '',
      price: priceText(it.price),
      regular: priceText(it.regular_price),
      condition: it.condition,
      allVariants: it.all_variants,
      suggestions: it.suggestions,
      item: match ? { id: match.id, name: match.name, unit: match.unit } : null,
    };
  });
}

/** Valida a linha marcada; devolve o payload ou a mensagem de erro. */
function rowPayload(row: IRow) {
  const unitValue = parsePrice(row.price);
  if (!Number.isFinite(unitValue) || unitValue <= 0) {
    return { error: `Preço inválido em "${row.name}".` };
  }
  const regular = row.regular.trim() ? parsePrice(row.regular) : null;
  if (regular !== null && (!Number.isFinite(regular) || regular <= 0)) {
    return { error: `Preço "de" inválido em "${row.name}".` };
  }
  if (row.name.trim().length < 2) {
    return { error: 'Há um item sem nome.' };
  }
  return {
    data: {
      item_id: row.item?.id ?? null,
      name: row.name.trim(),
      unit: row.unit.trim() || null,
      unit_value: unitValue,
      regular_value: regular,
    },
  };
}

/**
 * Importação de encartes/panfletos (só-admin): lê várias imagens com a IA,
 * deixa revisar cada item (preço, "de", item do catálogo) e grava como
 * observações de preço `flyer`. As imagens não são armazenadas.
 */
export function FlyerImport({ enabled }: { enabled: boolean }) {
  const { errorFeedbackToast, successFeedbackToast } = useFeedback();
  const fileInput = useRef<HTMLInputElement>(null);
  const [flyers, setFlyers] = useState<IFlyer[]>([]);
  const [busy, setBusy] = useState(false);

  useBeforeUnload(busy, 'Ainda há encartes sendo lidos ou gravados. Deseja mesmo sair?');

  function patchFlyer(key: string, patch: Partial<IFlyer>) {
    setFlyers((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  function patchRow(flyerKey: string, rowKey: string, patch: Partial<IRow>) {
    setFlyers((prev) =>
      prev.map((f) =>
        f.key === flyerKey
          ? { ...f, rows: f.rows.map((r) => (r.key === rowKey ? { ...r, ...patch } : r)) }
          : f,
      ),
    );
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !enabled) {
      return;
    }
    const today = toDateInputValue(new Date());
    const queued: { flyer: IFlyer; file: File }[] = Array.from(files).map((file, i) => ({
      file,
      flyer: {
        key: `${Date.now()}-${i}`,
        fileName: file.name,
        thumb: URL.createObjectURL(file),
        status: 'queued',
        store: null,
        regionText: null,
        validUntil: null,
        observedAt: today,
        state: '',
        cities: '',
        rows: [],
      },
    }));
    setFlyers((prev) => [...prev, ...queued.map((q) => q.flyer)]);
    setBusy(true);

    // Uma por vez: cada leitura leva dezenas de segundos e custa uma chamada.
    for (const { flyer, file } of queued) {
      patchFlyer(flyer.key, { status: 'reading' });
      try {
        const image = downscaleToJpeg(await loadImage(file), FLYER_MAX_SIDE, 0.85);
        const { data } = await api.post<{ data: IFlyerReadResponse }>(API_URL_FLYERS_READ, {
          image,
        });
        const reading = data.data;
        // Encarte que ainda vai começar não pode gravar data futura.
        const from = reading.valid_from && reading.valid_from < today ? reading.valid_from : today;
        patchFlyer(flyer.key, {
          status: 'ready',
          message: reading.items.length === 0 ? 'Nenhum produto com preço encontrado.' : undefined,
          store: reading.store,
          regionText: reading.region_text,
          validUntil: reading.valid_until,
          observedAt: from,
          state: reading.state ?? '',
          cities: reading.cities.join(', '),
          rows: rowsFromReading(reading, flyer.key),
        });
      } catch (e) {
        patchFlyer(flyer.key, { status: 'error', message: errorMessage(e) });
      }
    }
    setBusy(false);
  }

  /** Copia data e região deste encarte para os outros ainda não gravados. */
  function applyToAll(source: IFlyer) {
    setFlyers((prev) =>
      prev.map((f) =>
        f.key === source.key || f.status === 'saved'
          ? f
          : { ...f, observedAt: source.observedAt, state: source.state, cities: source.cities },
      ),
    );
  }

  async function saveFlyer(flyer: IFlyer): Promise<boolean> {
    const selected = flyer.rows.filter((r) => r.checked);
    if (selected.length === 0) {
      patchFlyer(flyer.key, { message: 'Nenhum item marcado.' });
      return false;
    }
    if (!flyer.state) {
      patchFlyer(flyer.key, { message: 'Informe a UF onde as ofertas valem.' });
      return false;
    }
    const items = [];
    for (const row of selected) {
      const payload = rowPayload(row);
      if (payload.error) {
        patchFlyer(flyer.key, { message: payload.error });
        return false;
      }
      items.push(payload.data);
    }

    patchFlyer(flyer.key, { status: 'saving', message: undefined });
    try {
      const { data } = await api.post<{ data: ISaveResult }>(API_URL_FLYERS_OBSERVATIONS, {
        observed_at: flyer.observedAt,
        state: flyer.state,
        cities: flyer.cities
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
        items,
      });
      const r = data.data;
      const failed = r.failed.length
        ? ` · ${r.failed.length} com erro: ${r.failed.map((f) => f.name).join(', ')}`
        : '';
      patchFlyer(flyer.key, {
        status: 'saved',
        message: `${r.created} preço(s) gravado(s), ${r.skipped} já existia(m)${failed}.`,
      });
      return true;
    } catch (e) {
      patchFlyer(flyer.key, { status: 'ready', message: errorMessage(e) });
      return false;
    }
  }

  async function saveAll() {
    const pending = flyers.filter((f) => f.status === 'ready');
    if (pending.length === 0) {
      return;
    }
    setBusy(true);
    let ok = 0;
    for (const flyer of pending) {
      if (await saveFlyer(flyer)) {
        ok += 1;
      }
    }
    setBusy(false);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [TABLE_PUBLIC_PRICES] }),
      // Itens sem correspondência entram no catálogo global.
      queryClient.invalidateQueries({ queryKey: [TABLE_ITEMS] }),
    ]);
    if (ok === pending.length) {
      successFeedbackToast('Encartes gravados', `${ok} encarte(s) entraram no índice público.`);
    } else {
      errorFeedbackToast(
        'Gravar encartes',
        new Error(
          `${pending.length - ok} encarte(s) precisam de ajuste — veja a mensagem em cada um.`,
        ),
      );
    }
  }

  function removeFlyer(key: string) {
    setFlyers((prev) => {
      const gone = prev.find((f) => f.key === key);
      if (gone) {
        URL.revokeObjectURL(gone.thumb);
      }
      return prev.filter((f) => f.key !== key);
    });
  }

  const readyCount = flyers.filter((f) => f.status === 'ready').length;

  return (
    <Stack gap="6">
      <Stack gap="0.5">
        <Heading size="lg" fontFamily="heading">
          Importar encarte
        </Heading>
        <Text fontSize="sm" color="fg.muted">
          Envie prints de encartes e panfletos de supermercado. A IA lê os produtos e preços; você
          confere, liga cada um a um item do catálogo e grava. O preço "por" (sem clube) entra nas
          médias públicas marcado como oferta. As imagens não ficam guardadas.
        </Text>
      </Stack>

      {!enabled && (
        <Card.Root bg="orange.50" borderColor="orange.200" _dark={{ bg: 'orange.950' }}>
          <Card.Body>
            <HStack gap="3" align="start">
              <Icon as={LuTriangleAlert} color="orange.500" boxSize={5} mt={0.5} />
              <Text fontSize="sm" color="fg.muted">
                A leitura usa a OpenAI. Defina{' '}
                <Text as="span" fontFamily="mono">
                  OPENAI_API_KEY
                </Text>{' '}
                para habilitar este recurso.
              </Text>
            </HStack>
          </Card.Body>
        </Card.Root>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <Flex gap="2" wrap="wrap" justify="space-between">
        <PrimaryButton
          size="sm"
          disabled={!enabled || busy}
          onClick={() => fileInput.current?.click()}
        >
          <LuImagePlus /> Escolher imagens
        </PrimaryButton>
        {readyCount > 0 && (
          <Button size="sm" variant="outline" loading={busy} onClick={saveAll}>
            <LuSave /> Gravar {readyCount} encarte(s)
          </Button>
        )}
      </Flex>

      {flyers.map((flyer) => (
        <Card.Root key={flyer.key} bg="bg.surface">
          <Card.Body>
            <Stack gap="4">
              <Flex gap="4" align="start" direction={{ base: 'column', md: 'row' }}>
                <Image
                  src={flyer.thumb}
                  alt={flyer.fileName}
                  w={{ base: 'full', md: '40' }}
                  maxH="64"
                  objectFit="contain"
                  borderRadius="md"
                  bg="bg.muted"
                />
                <Stack gap="3" flex="1" minW="0" w="full">
                  <Flex justify="space-between" align="center" gap="2" wrap="wrap">
                    <Stack gap="0" minW="0">
                      <Text fontWeight="semibold" truncate>
                        {flyer.store ?? flyer.fileName}
                      </Text>
                      {(flyer.regionText || flyer.validUntil) && (
                        <Text fontSize="xs" color="fg.muted">
                          {[flyer.regionText, flyer.validUntil && `válido até ${flyer.validUntil}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      )}
                    </Stack>
                    <HStack gap="2">
                      <StatusBadge
                        withDot={false}
                        label={STATUS_INFO[flyer.status].label}
                        colorPalette={STATUS_INFO[flyer.status].colorPalette}
                      />
                      <Button
                        size="xs"
                        variant="ghost"
                        aria-label="Remover encarte"
                        disabled={flyer.status === 'reading' || flyer.status === 'saving'}
                        onClick={() => removeFlyer(flyer.key)}
                      >
                        <LuTrash2 />
                      </Button>
                    </HStack>
                  </Flex>

                  {flyer.message && (
                    <Text fontSize="sm" color={flyer.status === 'saved' ? 'green.fg' : 'orange.fg'}>
                      {flyer.message}
                    </Text>
                  )}

                  {flyer.status === 'ready' && (
                    <Flex gap="2" wrap="wrap" align="end">
                      <Stack gap="1">
                        <Text fontSize="xs" fontWeight="semibold" color="fg.muted">
                          Data da oferta
                        </Text>
                        <Input
                          type="date"
                          size="sm"
                          w="40"
                          max={toDateInputValue(new Date())}
                          value={flyer.observedAt}
                          onChange={(e) => patchFlyer(flyer.key, { observedAt: e.target.value })}
                        />
                      </Stack>
                      <Box w="24">
                        <Select
                          name={`state-${flyer.key}`}
                          label="UF"
                          size="sm"
                          placeholder="UF"
                          options={UF_OPTIONS}
                          value={flyer.state || null}
                          onChange={(v) => patchFlyer(flyer.key, { state: v ?? '' })}
                        />
                      </Box>
                      <Stack gap="1" flex="1" minW="48">
                        <Text fontSize="xs" fontWeight="semibold" color="fg.muted">
                          Cidades (separadas por vírgula; vazio = UF inteira)
                        </Text>
                        <Input
                          size="sm"
                          value={flyer.cities}
                          onChange={(e) => patchFlyer(flyer.key, { cities: e.target.value })}
                        />
                      </Stack>
                      {flyers.length > 1 && (
                        <Button size="sm" variant="ghost" onClick={() => applyToAll(flyer)}>
                          <LuCopy /> Aplicar a todos
                        </Button>
                      )}
                    </Flex>
                  )}
                </Stack>
              </Flex>

              {flyer.status === 'ready' && flyer.rows.length > 0 && (
                <Stack gap="2">
                  {flyer.rows.map((row) => (
                    <Flex
                      key={row.key}
                      gap="3"
                      align="start"
                      borderWidth="1px"
                      borderRadius="lg"
                      p="3"
                      opacity={row.checked ? 1 : 0.6}
                    >
                      <Checkbox.Root
                        mt="2"
                        checked={row.checked}
                        onCheckedChange={(e) =>
                          patchRow(flyer.key, row.key, { checked: !!e.checked })
                        }
                      >
                        <Checkbox.HiddenInput />
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox.Root>
                      <Stack gap="2" flex="1" minW="0">
                        <Flex gap="2" wrap="wrap">
                          <Input
                            size="sm"
                            flex="1"
                            minW="48"
                            aria-label="Nome do produto"
                            value={row.name}
                            onChange={(e) => patchRow(flyer.key, row.key, { name: e.target.value })}
                          />
                          <Input
                            size="sm"
                            w="16"
                            aria-label="Unidade"
                            placeholder="un"
                            value={row.unit}
                            onChange={(e) =>
                              patchRow(flyer.key, row.key, { unit: e.target.value.slice(0, 10) })
                            }
                          />
                          <Input
                            size="sm"
                            w="24"
                            inputMode="decimal"
                            aria-label="Preço"
                            placeholder="Preço"
                            value={row.price}
                            onChange={(e) =>
                              patchRow(flyer.key, row.key, { price: e.target.value })
                            }
                          />
                          <Input
                            size="sm"
                            w="24"
                            inputMode="decimal"
                            aria-label='Preço "de"'
                            placeholder='"de"'
                            value={row.regular}
                            onChange={(e) =>
                              patchRow(flyer.key, row.key, { regular: e.target.value })
                            }
                          />
                        </Flex>
                        {(row.condition || row.allVariants) && (
                          <HStack gap="2" wrap="wrap">
                            {row.condition && (
                              <StatusBadge
                                withDot={false}
                                colorPalette="orange"
                                label={row.condition}
                              />
                            )}
                            {row.allVariants && (
                              <StatusBadge
                                withDot={false}
                                colorPalette="gray"
                                label="todas as variantes"
                              />
                            )}
                          </HStack>
                        )}
                        <Flex gap="2" wrap="wrap" align="center">
                          <Box flex="1" minW="56">
                            <SelectWithService<IItemAPI>
                              name={`item-${row.key}`}
                              size="sm"
                              clearable
                              placeholder="Criar item novo pelo nome"
                              onSearch={getItems}
                              parameters={PRODUCT_ONLY}
                              value={row.item as IItemAPI | null}
                              onChange={(item) =>
                                patchRow(flyer.key, row.key, {
                                  item: item
                                    ? { id: item.id, name: item.name, unit: item.unit }
                                    : null,
                                })
                              }
                            />
                          </Box>
                          {row.suggestions
                            .filter((s) => s.id !== row.item?.id)
                            .map((s) => (
                              <Button
                                key={s.id}
                                size="xs"
                                variant="outline"
                                maxW="64"
                                title={s.samePack ? undefined : 'Tamanho de embalagem diferente'}
                                onClick={() =>
                                  patchRow(flyer.key, row.key, {
                                    item: { id: s.id, name: s.name, unit: s.unit },
                                  })
                                }
                              >
                                <Text as="span" truncate>
                                  {s.name}
                                </Text>
                                <Text as="span" color="fg.muted">
                                  {Math.round(s.similarity * 100)}%
                                </Text>
                              </Button>
                            ))}
                        </Flex>
                      </Stack>
                    </Flex>
                  ))}
                  <Flex justify="end">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={async () => {
                        if (await saveFlyer(flyer)) {
                          await queryClient.invalidateQueries({ queryKey: [TABLE_PUBLIC_PRICES] });
                          await queryClient.invalidateQueries({ queryKey: [TABLE_ITEMS] });
                        }
                      }}
                    >
                      <LuSave /> Gravar {flyer.rows.filter((r) => r.checked).length} item(ns)
                    </Button>
                  </Flex>
                </Stack>
              )}
            </Stack>
          </Card.Body>
        </Card.Root>
      ))}
    </Stack>
  );
}
