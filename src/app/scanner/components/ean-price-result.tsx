'use client';

import { Card, Flex, HStack, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { MiniBars } from '~/components/charts/MiniBars';
import { APP_TIME_ZONE, formatPct, formatPrice, samplesText } from '~/lib/format';
import type { IEanPriceResult, ITier } from '~/services/public-prices';

type TierKey = 'city' | 'state' | 'country';

function tierLabel(key: TierKey, region: IEanPriceResult['region']): string {
  if (key === 'city') {
    return region.city ? `Em ${region.city}` : 'Na sua cidade';
  }
  if (key === 'state') {
    return region.state ? `Em ${region.state}` : 'No seu estado';
  }
  return 'No Brasil';
}

function seenOn(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: APP_TIME_ZONE,
  });
}

/** Recorte mais específico que tem dado: cidade → UF → Brasil. */
export function bestTier(result: IEanPriceResult): { key: TierKey; tier: ITier } | null {
  const tiers = result.tiers;
  if (!tiers) {
    return null;
  }
  for (const key of ['city', 'state', 'country'] as const) {
    const tier = tiers[key];
    if (tier) {
      return { key, tier };
    }
  }
  return null;
}

/** Explica o fallback quando o recorte mostrado não é o da cidade pedida. */
function fallbackNote(shown: TierKey, region: IEanPriceResult['region']): string | null {
  if (shown === 'state' && region.city) {
    return `Ainda não temos preços deste produto em ${region.city} — mostrando a média de ${region.state}.`;
  }
  if (shown === 'country' && (region.city || region.state)) {
    return `Ainda não temos preços deste produto em ${region.city ?? region.state} — mostrando a média do Brasil.`;
  }
  return null;
}

function SmallTier({ label, tier }: { label: string; tier: ITier | null }) {
  return (
    <Card.Root bg="bg.surface" size="sm">
      <Card.Body>
        <Stack gap="0.5">
          <Text fontSize="xs" fontWeight="semibold" color="fg.muted">
            {label}
          </Text>
          {tier ? (
            <>
              <Text fontSize="lg" fontWeight="bold" fontVariantNumeric="tabular-nums">
                {formatPrice(tier.avgPrice)}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                {samplesText(tier.samples)} · visto em {seenOn(tier.lastSeenAt)}
              </Text>
            </>
          ) : (
            <Text fontSize="sm" color="fg.muted">
              Sem amostras ainda
            </Text>
          )}
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}

interface IEanPriceResultProps {
  result: IEanPriceResult;
  /** Preço da etiqueta, para dizer se está acima/abaixo da média. */
  comparePrice?: number | null;
}

/**
 * Preço de um produto nos três recortes. O destaque vai para o recorte mais
 * específico que tem dado; quando a cidade (ou a UF) não tem amostra, uma linha
 * explica para qual recorte caímos.
 */
export function EanPriceResult({ result, comparePrice }: IEanPriceResultProps) {
  const { item, tiers, region } = result;
  const best = bestTier(result);
  if (!item || !tiers) {
    return null;
  }

  const note = best ? fallbackNote(best.key, region) : null;
  const delta =
    best && comparePrice && best.tier.avgPrice > 0
      ? (comparePrice - best.tier.avgPrice) / best.tier.avgPrice
      : null;

  return (
    <Stack gap="3">
      <Stack gap="0">
        <Text fontWeight="semibold">{item.name}</Text>
        <Text fontSize="xs" color="fg.muted">
          EAN {result.ean}
          {item.category ? ` · ${item.category.name}` : ''} · últimos {result.sinceMonths} meses
        </Text>
      </Stack>

      {best ? (
        <Card.Root bg="bg.surface" borderColor="teal.200" _dark={{ borderColor: 'teal.800' }}>
          <Card.Body>
            <Stack gap="3">
              <Flex justify="space-between" align="start" gap="3">
                <Stack gap="0">
                  <Text fontSize="xs" fontWeight="semibold" color="teal.fg">
                    Preço médio · {tierLabel(best.key, region)}
                  </Text>
                  <Text fontSize="3xl" fontWeight="bold" fontVariantNumeric="tabular-nums">
                    {formatPrice(best.tier.avgPrice)}
                    {item.unit && (
                      <Text as="span" fontSize="sm" fontWeight="medium" color="fg.muted">
                        {' '}
                        /{item.unit.toLowerCase()}
                      </Text>
                    )}
                  </Text>
                </Stack>
                <Stack gap="0" align="end" flexShrink={0}>
                  <Text fontSize="xs" color="fg.muted">
                    {samplesText(best.tier.samples)}
                  </Text>
                  <Text fontSize="xs" color="fg.muted">
                    visto em {seenOn(best.tier.lastSeenAt)}
                  </Text>
                </Stack>
              </Flex>

              {best.tier.samples > 1 && (
                <HStack gap="4" fontSize="xs" color="fg.muted">
                  <Text>mín. {formatPrice(best.tier.minPrice)}</Text>
                  <Text>máx. {formatPrice(best.tier.maxPrice)}</Text>
                </HStack>
              )}

              {delta !== null && (
                <Text
                  fontSize="sm"
                  fontWeight="semibold"
                  color={delta > 0 ? 'price.up' : 'price.down'}
                >
                  {Math.abs(delta) < 0.005
                    ? 'Esta etiqueta está na média.'
                    : `Esta etiqueta está ${formatPct(Math.abs(delta))} ${
                        delta > 0 ? 'acima' : 'abaixo'
                      } da média.`}
                </Text>
              )}

              {best.tier.series.length > 1 && <MiniBars points={best.tier.series} decimals={2} />}

              {note && (
                <Text fontSize="xs" color="fg.muted">
                  {note}
                </Text>
              )}
            </Stack>
          </Card.Body>
        </Card.Root>
      ) : (
        <Card.Root bg="bg.surface">
          <Card.Body>
            <Text fontSize="sm" color="fg.muted">
              Conhecemos este produto, mas não há preço registrado nos últimos {result.sinceMonths}{' '}
              meses.
            </Text>
          </Card.Body>
        </Card.Root>
      )}

      {best && (
        <SimpleGrid columns={{ base: 1, sm: 3 }} gap="3">
          <SmallTier label={tierLabel('city', region)} tier={tiers.city} />
          <SmallTier label={tierLabel('state', region)} tier={tiers.state} />
          <SmallTier label={tierLabel('country', region)} tier={tiers.country} />
        </SimpleGrid>
      )}
    </Stack>
  );
}
