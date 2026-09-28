'use client';

import { Box, Button, Card, Flex, HStack, Icon, Input, Stack, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { LuLocateFixed, LuMapPin } from 'react-icons/lu';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import { Select } from '~/components/Form/Select';
import { toUpperLive } from '~/lib/normalize';
import { UFS } from '~/lib/ufs';
import type { useUserLocation } from '~/services/hooks/useUserLocation';

export type UserLocationState = ReturnType<typeof useUserLocation>;

const STATUS_NOTE: Partial<Record<UserLocationState['status'], string>> = {
  denied: 'Localização negada pelo navegador — informe a cidade manualmente.',
  unsupported: 'Este navegador não informa a localização — informe a cidade manualmente.',
  outside: 'Parece que você está fora do Brasil — informe a cidade manualmente.',
  error: 'Não foi possível obter a localização — tente de novo ou informe a cidade.',
};

const UF_OPTIONS = UFS.map((uf) => ({ value: uf, label: uf }));

/**
 * Região usada no recorte de preços: mostra a cidade atual e deixa obter pelo GPS
 * ou digitar. A coordenada nunca é guardada — só cidade/UF.
 */
export function LocationBar({ userLocation }: { userLocation: UserLocationState }) {
  const { location, status, locate, setManual, clear } = userLocation;
  const [editing, setEditing] = useState(false);
  const [uf, setUf] = useState('');
  const [city, setCity] = useState('');

  function openEditor() {
    setUf(location?.state ?? '');
    setCity(location?.city ?? '');
    setEditing(true);
  }

  function saveManual() {
    if (!uf || city.trim().length < 2) {
      return;
    }
    setManual(uf, city);
    setEditing(false);
  }

  const note = STATUS_NOTE[status];

  return (
    <Card.Root bg="bg.surface" size="sm">
      <Card.Body>
        <Stack gap="3">
          <Flex justify="space-between" align="center" gap="3" wrap="wrap">
            <HStack gap="2" minW="0">
              <Icon as={LuMapPin} color="teal.600" boxSize={4} />
              <Text fontSize="sm" fontWeight="semibold" truncate>
                {location
                  ? `${location.city.toUpperCase()}/${location.state}`
                  : 'Região não definida'}
              </Text>
            </HStack>
            <HStack gap="1">
              <Button
                size="xs"
                variant="ghost"
                loading={status === 'locating'}
                onClick={locate}
                aria-label="Usar minha localização"
              >
                <LuLocateFixed /> Usar minha localização
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={editing ? () => setEditing(false) : openEditor}
              >
                {editing ? 'Cancelar' : 'Alterar'}
              </Button>
            </HStack>
          </Flex>

          {note && !editing && (
            <Text fontSize="xs" color="orange.fg">
              {note}
            </Text>
          )}
          {!location && !note && !editing && (
            <Text fontSize="xs" color="fg.muted">
              Defina sua região para ver o preço na sua cidade. Sem ela, mostramos a média do
              Brasil.
            </Text>
          )}

          {editing && (
            <Flex gap="2" align="end" wrap="wrap">
              <Box w="24">
                <Select
                  name="scanner-uf"
                  label="UF"
                  size="sm"
                  placeholder="UF"
                  options={UF_OPTIONS}
                  value={uf}
                  onChange={(v) => setUf(v ?? '')}
                />
              </Box>
              <Box flex="1" minW="40">
                <Text fontSize="sm" fontWeight="medium" mb="1.5">
                  Cidade
                </Text>
                <Input
                  size="sm"
                  placeholder="Sua cidade"
                  value={city}
                  onChange={(e) => setCity(toUpperLive(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      saveManual();
                    }
                  }}
                />
              </Box>
              <PrimaryButton
                size="sm"
                onClick={saveManual}
                disabled={!uf || city.trim().length < 2}
              >
                Salvar
              </PrimaryButton>
              {location && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    clear();
                    setEditing(false);
                  }}
                >
                  Limpar
                </Button>
              )}
            </Flex>
          )}
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}
