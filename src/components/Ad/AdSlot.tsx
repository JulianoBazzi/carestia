'use client';

import { Center, Icon, Stack, Text } from '@chakra-ui/react';
import { LuMegaphone } from 'react-icons/lu';

export type AdVariant = 'banner' | 'square' | 'vertical';

const SIZES: Record<AdVariant, { w: number | string; maxW?: number; h: number }> = {
  banner: { w: 'full', maxW: 728, h: 90 },
  square: { w: 300, h: 250 },
  vertical: { w: 300, h: 600 },
};

/**
 * Espaço fixo de anúncio (placeholder). Apenas reserva o espaço no layout, como no
 * design — sem integração com AdSense ou qualquer rede de anúncios.
 */
export function AdSlot({ variant = 'banner' }: { variant?: AdVariant }) {
  const s = SIZES[variant];
  return (
    <Center
      w={s.w}
      maxW={s.maxW}
      h={s.h}
      mx="auto"
      bg="bg.subtle"
      borderWidth="1px"
      borderStyle="dashed"
      borderColor="border.emphasized"
      borderRadius="xl"
      flexShrink={0}
    >
      <Stack align="center" gap="0.5" color="fg.muted">
        <Icon as={LuMegaphone} boxSize={5} />
        <Text fontSize="xs" fontWeight="medium">
          Publicidade
        </Text>
        <Text fontSize="2xs">Espaço reservado</Text>
      </Stack>
    </Center>
  );
}
