'use client';

import {
  Box,
  Button,
  Card,
  Flex,
  HStack,
  Image,
  Input,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useBeforeUnload } from '@julianobazzi/nextjs-utils';
import { useEffect, useRef, useState } from 'react';
import { LuCamera, LuCheck, LuImage, LuRotateCcw } from 'react-icons/lu';
import { EanPriceResult } from '~/app/scanner/components/ean-price-result';
import { LocationBar, type UserLocationState } from '~/app/scanner/components/location-bar';
import { FeatureUnavailable, LoginGate } from '~/app/scanner/components/login-gate';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import {
  API_URL_LABELS_READ,
  API_URL_PRICE_OBSERVATIONS,
  TABLE_PUBLIC_PRICES,
} from '~/config/constants';
import { useFeedback } from '~/contexts/FeedbackContext';
import { isCatalogGtin, isValidGtin, normalizeEan } from '~/lib/ean';
import { parsePrice } from '~/lib/format';
import { detectBarcode, downscaleToJpeg, loadImage } from '~/lib/image';
import { toUpperLive } from '~/lib/normalize';
import { api } from '~/services/apiClient';
import { useEanPrice } from '~/services/hooks/usePublicPrices';
import type { IEanPriceResult } from '~/services/public-prices';
import { queryClient } from '~/services/queryClient';

interface ILabelForm {
  ean: string;
  name: string;
  price: string;
  unit: string;
}

const EMPTY_FORM: ILabelForm = { ean: '', name: '', price: '', unit: '' };

interface ILabelTabProps {
  loggedIn: boolean;
  /** `OPENAI_API_KEY` configurado no servidor. */
  enabled: boolean;
  registrationOpen: boolean;
  userLocation: UserLocationState;
  /** EAN vindo da aba de código de barras (produto não catalogado). */
  initialEan: string | null;
}

/**
 * Aba "Etiqueta": fotografa a etiqueta da gôndola, lê EAN + preço (o código de
 * barras detectado no aparelho vence o lido pelo modelo), deixa o usuário
 * conferir e registra o preço como observação — que entra nas médias públicas.
 * A foto não é armazenada.
 */
export function LabelTab({
  loggedIn,
  enabled,
  registrationOpen,
  userLocation,
  initialEan,
}: ILabelTabProps) {
  const { errorFeedbackToast, successFeedbackToast, warningFeedbackToast } = useFeedback();
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ILabelForm>({ ...EMPTY_FORM, ean: initialEan ?? '' });
  const [hasForm, setHasForm] = useState(Boolean(initialEan));
  const [saved, setSaved] = useState<IEanPriceResult | null>(null);
  const { location } = userLocation;

  useBeforeUnload(reading || saving, 'A leitura ainda está em andamento. Deseja mesmo sair?');

  useEffect(() => {
    if (initialEan) {
      setForm((f) => ({ ...f, ean: initialEan }));
      setHasForm(true);
    }
  }, [initialEan]);

  const ean = normalizeEan(form.ean);
  const validEan = isCatalogGtin(ean) ? ean : null;
  const price = parsePrice(form.price);
  const validPrice = Number.isFinite(price) && price > 0 ? price : null;

  // Comparação ao vivo enquanto o usuário confere o formulário.
  const { data: lookup } = useEanPrice(hasForm && !saved ? validEan : null, location ?? {});
  const knownItem = lookup?.item ?? null;

  if (!loggedIn) {
    return (
      <Stack pt="2">
        <LoginGate tab="label" registrationOpen={registrationOpen}>
          Entre na sua conta para fotografar etiquetas de preço. Cada preço registrado ajuda a
          mostrar quanto custa viver na sua cidade.
        </LoginGate>
      </Stack>
    );
  }

  if (!enabled) {
    return (
      <Stack pt="2">
        <FeatureUnavailable>A leitura de etiqueta está indisponível no momento.</FeatureUnavailable>
      </Stack>
    );
  }

  function reset() {
    setPreview(null);
    setForm(EMPTY_FORM);
    setHasForm(false);
    setSaved(null);
  }

  async function handleFile(file: File | undefined) {
    if (!file) {
      return;
    }
    setSaved(null);
    setReading(true);
    try {
      const img = await loadImage(file);
      const dataUrl = downscaleToJpeg(img);
      setPreview(dataUrl);
      // Em paralelo: leitura local do código de barras + leitura da etiqueta pela IA.
      const [localEan, response] = await Promise.all([
        detectBarcode(img),
        api.post<{
          data: {
            ean: string | null;
            price: number | null;
            name: string | null;
            unit: string | null;
          };
        }>(API_URL_LABELS_READ, { image: dataUrl }),
      ]);
      const r = response.data.data;
      const local =
        localEan && isCatalogGtin(normalizeEan(localEan)) ? normalizeEan(localEan) : null;
      setForm((prev) => ({
        ean: local ?? r.ean ?? prev.ean,
        name: r.name ? toUpperLive(r.name) : '',
        price: r.price !== null ? r.price.toFixed(2).replace('.', ',') : '',
        unit: r.unit ? toUpperLive(r.unit) : '',
      }));
      setHasForm(true);
      if (!r.price || !(local ?? r.ean)) {
        warningFeedbackToast(
          'Leitura parcial',
          'Não consegui ler tudo na foto. Confira e complete os campos.',
        );
      }
    } catch (e) {
      errorFeedbackToast('Ler etiqueta', e);
      // Deixa preencher à mão mesmo sem a leitura.
      setHasForm(true);
    } finally {
      setReading(false);
    }
  }

  async function save() {
    if (!validEan) {
      warningFeedbackToast('Código de barras inválido', 'Confira os dígitos do código.');
      return;
    }
    if (!validPrice) {
      warningFeedbackToast('Preço inválido', 'Informe o preço da etiqueta.');
      return;
    }
    if (!location) {
      warningFeedbackToast('Defina sua região', 'Precisamos da cidade para registrar o preço.');
      return;
    }
    if (!knownItem && form.name.trim().length < 2) {
      warningFeedbackToast('Informe o nome', 'Este produto ainda não está no catálogo.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post<{ data: { id: string; prices: IEanPriceResult } }>(
        API_URL_PRICE_OBSERVATIONS,
        {
          ean: validEan,
          name: form.name || null,
          unit: form.unit || null,
          unit_value: validPrice,
          city: location.city,
          state: location.state,
          ibge_code: location.ibge_code,
        },
      );
      setSaved(data.data.prices);
      successFeedbackToast('Preço registrado', 'Obrigado! Ele já entra nas médias da sua região.');
      await queryClient.invalidateQueries({ queryKey: [TABLE_PUBLIC_PRICES] });
    } catch (e) {
      errorFeedbackToast('Registrar preço', e);
    } finally {
      setSaving(false);
    }
  }

  const comparison = saved ?? (lookup?.item ? lookup : null);

  return (
    <Stack gap="4" pt="2">
      <LocationBar userLocation={userLocation} />

      {/* `capture` abre a câmera direto no celular; o segundo input dá acesso à galeria. */}
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <Card.Root bg="bg.surface">
        <Card.Body>
          <Stack gap="3">
            {preview ? (
              <Box position="relative" borderRadius="lg" overflow="hidden" bg="black">
                <Image
                  src={preview}
                  alt="Foto da etiqueta"
                  maxH="56"
                  w="full"
                  objectFit="contain"
                />
                {reading && (
                  <HStack
                    position="absolute"
                    inset="0"
                    justify="center"
                    bg="blackAlpha.700"
                    color="white"
                    gap="2"
                  >
                    <Spinner size="sm" />
                    <Text fontSize="sm" fontWeight="semibold">
                      Lendo a etiqueta…
                    </Text>
                  </HStack>
                )}
              </Box>
            ) : (
              <Text fontSize="sm" color="fg.muted">
                Fotografe a etiqueta de preço da gôndola, de frente e com o código de barras
                visível. A foto é usada só para a leitura e não fica guardada.
              </Text>
            )}
            <Flex gap="2" wrap="wrap">
              <PrimaryButton
                size="sm"
                loading={reading}
                onClick={() => cameraInput.current?.click()}
              >
                <LuCamera /> {preview ? 'Tirar outra foto' : 'Tirar foto'}
              </PrimaryButton>
              <Button
                size="sm"
                variant="outline"
                disabled={reading}
                onClick={() => galleryInput.current?.click()}
              >
                <LuImage /> Escolher da galeria
              </Button>
              {!hasForm && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={reading}
                  onClick={() => setHasForm(true)}
                >
                  Digitar manualmente
                </Button>
              )}
            </Flex>
          </Stack>
        </Card.Body>
      </Card.Root>

      {hasForm && !saved && (
        <Card.Root bg="bg.surface">
          <Card.Body>
            <Stack gap="3">
              <Text fontWeight="semibold">Confira os dados</Text>
              <Stack gap="1">
                <Text fontSize="xs" fontWeight="semibold" color="fg.muted">
                  Código de barras (EAN)
                </Text>
                <Input
                  name="label-ean"
                  inputMode="numeric"
                  autoComplete="off"
                  value={form.ean}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ean: e.target.value.replace(/\D/g, '').slice(0, 14) }))
                  }
                />
                {form.ean && !validEan && (
                  <Text fontSize="xs" color="orange.fg">
                    {isValidGtin(ean)
                      ? 'Código interno da loja (balança/uso interno) — não identifica o produto.'
                      : 'Os dígitos não conferem — compare com o número sob o código de barras.'}
                  </Text>
                )}
              </Stack>
              <Stack gap="1">
                <Text fontSize="xs" fontWeight="semibold" color="fg.muted">
                  Produto
                </Text>
                <Input
                  name="label-name"
                  placeholder={knownItem ? knownItem.name : 'Nome como está na etiqueta'}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: toUpperLive(e.target.value) }))}
                />
                {knownItem && (
                  <Text fontSize="xs" color="fg.muted">
                    Já catalogado como {knownItem.name}.
                  </Text>
                )}
              </Stack>
              <Flex gap="3">
                <Stack gap="1" flex="2">
                  <Text fontSize="xs" fontWeight="semibold" color="fg.muted">
                    Preço (R$)
                  </Text>
                  <Input
                    name="label-price"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  />
                </Stack>
                <Stack gap="1" flex="1">
                  <Text fontSize="xs" fontWeight="semibold" color="fg.muted">
                    Unidade
                  </Text>
                  <Input
                    name="label-unit"
                    placeholder="UN"
                    maxLength={10}
                    value={form.unit}
                    onChange={(e) => setForm((f) => ({ ...f, unit: toUpperLive(e.target.value) }))}
                  />
                </Stack>
              </Flex>
              <PrimaryButton loading={saving} disabled={reading} onClick={save}>
                <LuCheck /> Registrar preço
              </PrimaryButton>
            </Stack>
          </Card.Body>
        </Card.Root>
      )}

      {comparison && <EanPriceResult result={comparison} comparePrice={validPrice} />}

      {saved && (
        <Button variant="outline" onClick={reset}>
          <LuRotateCcw /> Registrar outra etiqueta
        </Button>
      )}
    </Stack>
  );
}
