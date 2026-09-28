'use client';

import { Button, Card, Flex, Input, Skeleton, Stack, Text } from '@chakra-ui/react';
import NextLink from 'next/link';
import { useState } from 'react';
import { LuPackageSearch, LuSearch, LuTag } from 'react-icons/lu';
import { CameraScanner } from '~/app/scanner/components/camera-scanner';
import { EanPriceResult } from '~/app/scanner/components/ean-price-result';
import { LocationBar, type UserLocationState } from '~/app/scanner/components/location-bar';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import { EmptyState } from '~/components/EmptyState';
import { useFeedback } from '~/contexts/FeedbackContext';
import { isCatalogGtin, isValidGtin, normalizeEan } from '~/lib/ean';
import { useEanPrice } from '~/services/hooks/usePublicPrices';

interface IBarcodeTabProps {
  loggedIn: boolean;
  userLocation: UserLocationState;
  /** Leva o EAN não catalogado para a aba de etiqueta. */
  onRegisterLabel: (ean: string) => void;
}

/** Aba "Preço": lê o código de barras e mostra o preço na região do usuário. */
export function BarcodeTab({ loggedIn, userLocation, onRegisterLabel }: IBarcodeTabProps) {
  const { warningFeedbackToast } = useFeedback();
  const [ean, setEan] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const { location } = userLocation;

  const { data, isFetching, isError } = useEanPrice(ean, location ?? {});

  function lookup(raw: string) {
    const digits = normalizeEan(raw);
    if (!isValidGtin(digits)) {
      warningFeedbackToast('Código inválido', 'Confira os dígitos do código de barras.');
      return false;
    }
    if (!isCatalogGtin(digits)) {
      warningFeedbackToast(
        'Código interno da loja',
        'Etiquetas de balança e códigos internos mudam de loja para loja e não identificam o produto.',
      );
      return false;
    }
    setEan(digits);
    return true;
  }

  return (
    <Stack gap="4" pt="2">
      <LocationBar userLocation={userLocation} />

      <CameraScanner
        formats={['ean_13', 'ean_8', 'upc_a', 'upc_e']}
        paused={Boolean(ean)}
        onResume={() => setEan(null)}
        onDetected={(code) => lookup(code.rawValue)}
        hint="Aponte a câmera para o código de barras do produto."
      />

      <Card.Root bg="bg.surface" size="sm">
        <Card.Body>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (lookup(typed)) {
                setTyped('');
              }
            }}
          >
            <Flex gap="2" align="end">
              <Stack gap="1" flex="1">
                <Text fontSize="xs" fontWeight="semibold" color="fg.muted">
                  Ou digite o código de barras
                </Text>
                <Input
                  name="ean"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="7891234567895"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value.replace(/\D/g, '').slice(0, 14))}
                />
              </Stack>
              <PrimaryButton type="submit" disabled={typed.length < 8}>
                <LuSearch /> Consultar
              </PrimaryButton>
            </Flex>
          </form>
        </Card.Body>
      </Card.Root>

      {ean && isFetching && !data && (
        <Stack gap="3">
          <Skeleton h="6" w="60%" />
          <Skeleton h="36" borderRadius="xl" />
        </Stack>
      )}

      {ean && isError && (
        <Card.Root bg="bg.surface">
          <Card.Body>
            <Text fontSize="sm" color="fg.muted">
              Não foi possível consultar o preço agora. Tente de novo em instantes.
            </Text>
          </Card.Body>
        </Card.Root>
      )}

      {ean && data?.item && <EanPriceResult result={data} />}

      {ean && data && !data.item && (
        <Card.Root bg="bg.surface">
          <Card.Body>
            <EmptyState
              icon={<LuPackageSearch />}
              title="Produto ainda não catalogado"
              description={`Ninguém registrou o código ${data.ean} ainda. Fotografe a etiqueta da gôndola para cadastrar o produto e o preço.`}
              action={
                loggedIn ? (
                  <PrimaryButton size="sm" onClick={() => onRegisterLabel(data.ean)}>
                    <LuTag /> Registrar pela etiqueta
                  </PrimaryButton>
                ) : (
                  <Button size="sm" variant="outline" asChild>
                    <NextLink
                      href={`/login?next=${encodeURIComponent(`/scanner?tab=label&ean=${data.ean}`)}`}
                    >
                      Entrar para registrar
                    </NextLink>
                  </Button>
                )
              }
            />
          </Card.Body>
        </Card.Root>
      )}
    </Stack>
  );
}
