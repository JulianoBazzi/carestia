'use client';

import {
  Circle,
  Dialog,
  Flex,
  HStack,
  Icon,
  Input,
  Portal,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { type Ref, useImperativeHandle, useState } from 'react';
import { LuPlus, LuTags, LuTrash2 } from 'react-icons/lu';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import { SecondaryButton } from '~/components/Button/Base/SecondaryButton';
import { ActionIconButton } from '~/components/Button/IconButton';
import { API_URL_ITEMS, TABLE_ITEM_ALIASES } from '~/config/constants';
import { useFeedback } from '~/contexts/FeedbackContext';
import type IItemAPI from '~/models/Entity/Item/IItemAPI';
import { api } from '~/services/apiClient';
import { queryClient } from '~/services/queryClient';

interface IItemAlias {
  id: string;
  name: string;
  reference_code: string;
}

export type AliasesModalHandle = { open: (item: IItemAPI) => void };

/**
 * Manutenção dos nomes alternativos (aliases) de um item: notas fiscais cujo
 * nome bater com um alias (mesmo tipo+código) entram direto no item principal.
 * A mesclagem também grava aliases automaticamente; aqui o admin ajusta à mão.
 */
export function AliasesModal({ ref }: { ref?: Ref<AliasesModalHandle> }) {
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState<IItemAPI | null>(null);
  const [name, setName] = useState('');
  const { successFeedbackToast, errorFeedbackToast } = useFeedback();

  useImperativeHandle(
    ref,
    () => ({
      open(target: IItemAPI) {
        setItem(target);
        setName('');
        setOpen(true);
      },
    }),
    [],
  );

  const aliasesQuery = useQuery({
    queryKey: [TABLE_ITEM_ALIASES, item?.id],
    queryFn: async () => {
      const { data } = await api.get<{ data: IItemAlias[] }>(
        `${API_URL_ITEMS}/${item?.id}/aliases`,
      );
      return data.data;
    },
    enabled: open && !!item,
  });

  const addMutation = useMutation({
    mutationFn: () => api.post(`${API_URL_ITEMS}/${item?.id}/aliases`, { name }),
    async onSuccess() {
      successFeedbackToast('Nomes alternativos', 'Nome adicionado.');
      setName('');
      await queryClient.invalidateQueries({ queryKey: [TABLE_ITEM_ALIASES, item?.id] });
    },
    onError(error: Error) {
      errorFeedbackToast('Nomes alternativos', error);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (aliasId: string) => api.delete(`${API_URL_ITEMS}/${item?.id}/aliases/${aliasId}`),
    async onSuccess() {
      successFeedbackToast('Nomes alternativos', 'Nome removido.');
      await queryClient.invalidateQueries({ queryKey: [TABLE_ITEM_ALIASES, item?.id] });
    },
    onError(error: Error) {
      errorFeedbackToast('Nomes alternativos', error);
    },
  });

  const aliases = aliasesQuery.data ?? [];

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(d) => {
        if (!d.open) {
          setOpen(false);
        }
      }}
      placement="center"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="md">
            <Dialog.Header>
              <HStack gap="3">
                <Circle size="10" bg="blue.subtle" color="blue.fg" flexShrink={0}>
                  <Icon as={LuTags} boxSize={5} />
                </Circle>
                <Stack gap="0">
                  <Dialog.Title fontSize="lg" fontFamily="heading">
                    Nomes alternativos
                  </Dialog.Title>
                  <Text fontSize="xs" color="fg.muted" truncate maxW="72">
                    {item?.name}
                  </Text>
                </Stack>
              </HStack>
            </Dialog.Header>

            <Dialog.Body>
              <Stack gap="4">
                <Text fontSize="sm" color="fg.muted">
                  Notas importadas com um destes nomes (mesmo tipo e código) entram direto neste
                  item, em vez de criar um duplicado.
                </Text>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!name.trim()) {
                      errorFeedbackToast('Nomes alternativos', 'Informe um nome.');
                      return;
                    }
                    addMutation.mutate();
                  }}
                >
                  <HStack gap="2">
                    <Input
                      size="sm"
                      placeholder="Ex.: ETANOL HIDRATADO COMUM"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                    <PrimaryButton size="sm" type="submit" loading={addMutation.isPending}>
                      <LuPlus /> Adicionar
                    </PrimaryButton>
                  </HStack>
                </form>

                {aliasesQuery.isLoading ? (
                  <HStack gap="2.5" py="4" color="fg.muted" justify="center">
                    <Spinner size="sm" />
                    <Text fontSize="sm">Carregando…</Text>
                  </HStack>
                ) : aliases.length === 0 ? (
                  <Stack align="center" gap="2" py="6" color="fg.muted">
                    <Icon as={LuTags} boxSize={6} />
                    <Text fontSize="sm">Nenhum nome alternativo ainda.</Text>
                  </Stack>
                ) : (
                  <Stack gap="2" maxH="16rem" overflowY="auto" pr="1">
                    {aliases.map((alias) => (
                      <Flex
                        key={alias.id}
                        justify="space-between"
                        align="center"
                        gap="3"
                        borderWidth="1px"
                        borderColor="border"
                        borderRadius="lg"
                        px="3"
                        py="2"
                        _hover={{ bg: 'bg.muted' }}
                      >
                        <Stack gap="0" minW="0">
                          <Text fontSize="sm" fontWeight="medium" truncate>
                            {alias.name}
                          </Text>
                          <Text fontSize="xs" color="fg.muted" fontVariantNumeric="tabular-nums">
                            {alias.reference_code}
                          </Text>
                        </Stack>
                        <ActionIconButton
                          aria-label="Remover nome"
                          colorPalette="red"
                          loading={
                            removeMutation.isPending && removeMutation.variables === alias.id
                          }
                          onClick={() => removeMutation.mutate(alias.id)}
                        >
                          <LuTrash2 />
                        </ActionIconButton>
                      </Flex>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Dialog.Body>

            <Dialog.Footer>
              <SecondaryButton onClick={() => setOpen(false)}>Fechar</SecondaryButton>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
