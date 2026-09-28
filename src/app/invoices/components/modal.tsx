'use client';

import { Box, Circle, Dialog, Flex, HStack, Icon, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { useBeforeUnload } from '@julianobazzi/nextjs-utils';
import { useMutation } from '@tanstack/react-query';
import { type Ref, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { LuFileText, LuPlus, LuShieldCheck, LuTrash2, LuZap } from 'react-icons/lu';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import { SecondaryButton } from '~/components/Button/Base/SecondaryButton';
import { ActionIconButton } from '~/components/Button/IconButton';
import { ConfirmDialog, type ConfirmDialogHandle } from '~/components/Form/ConfirmDialog';
import { Modal, type ModalHandle } from '~/components/Form/Modal';
import { Select } from '~/components/Form/Select';
import { SelectWithService } from '~/components/Form/SelectWithService';
import { Input } from '~/components/Input';
import { LoadingState } from '~/components/LoadingState';
import { API_URL_INVOICES, TABLE_INFLATION, TABLE_INVOICES } from '~/config/constants';
import { useFeedback } from '~/contexts/FeedbackContext';
import { formatPrice, toDateInputValue } from '~/lib/format';
import { maskAccessKey } from '~/lib/mask';
import type ICompanyAPI from '~/models/Entity/Company/ICompanyAPI';
import { api } from '~/services/apiClient';
import { getCompanies } from '~/services/hooks/useCompanies';
import { queryClient } from '~/services/queryClient';

export interface IEnergyDraft {
  accessKey?: string;
  issuedAt?: string;
  unitPriceKwh?: number;
  distribuidora?: string;
}

export type InvoiceModalHandle = {
  onOpenDialog: (invoiceId?: string) => void;
  openWithEnergyDraft: (draft: IEnergyDraft) => void;
};

type Model = 'nfe' | 'nfce' | 'nfse' | 'nf3e';

interface ItemRow {
  _key: string;
  /** Id da linha no banco (edição): o backend preserva o item casado se nada mudou. */
  id?: string;
  description: string;
  reference_code: string;
  unit: string;
  unit_value: string;
  /**
   * Tributo aproximado por unidade (R$/un), só das notas importadas por XML.
   * Só exibição: o backend preserva o valor da linha pelo `id`.
   */
  unit_tax_value: number | null;
}

interface FormState {
  id?: string;
  model: Model;
  number: string;
  series: string;
  issued_at: string; // yyyy-mm-dd
  access_key: string;
  company_id: string;
  company_label: string;
  neighborhood: string;
  city: string;
  state: string;
  items: ItemRow[];
}

const EMPTY: FormState = {
  model: 'nfe',
  number: '',
  series: '',
  issued_at: '',
  access_key: '',
  company_id: '',
  company_label: '',
  neighborhood: '',
  city: '',
  state: '',
  items: [],
};

const MODEL_OPTIONS: { value: Model; label: string }[] = [
  { value: 'nfe', label: 'NF-e (produtos)' },
  { value: 'nfce', label: 'NFC-e (varejo)' },
  { value: 'nfse', label: 'NFS-e (serviços)' },
  { value: 'nf3e', label: 'NF3e (energia)' },
];

export function InvoiceModal({ ref }: { ref?: Ref<InvoiceModalHandle> }) {
  const modalRef = useRef<ModalHandle>(null);
  const confirmRef = useRef<ConfirmDialogHandle>(null);
  const { successFeedbackToast, errorFeedbackToast } = useFeedback();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const keyCounter = useRef(0);
  // Snapshot do formulário no momento da abertura/carga, p/ detectar edição não salva.
  const baselineRef = useRef(JSON.stringify(EMPTY));

  useBeforeUnload(
    open && JSON.stringify(form) !== baselineRef.current,
    'A nota tem alterações não salvas. Deseja mesmo sair?',
  );

  const isCreate = !form.id;
  const isEnergy = form.model === 'nf3e';
  // O estado do form segue guardando só strings (company_id/company_label) —
  // preserva o dirty-check por JSON.stringify. Este objeto parcial existe só
  // para o select assíncrono exibir a seleção (ele lê apenas id e rótulo).
  const selectedCompany = useMemo<ICompanyAPI | null>(
    () =>
      form.company_id
        ? ({
            id: form.company_id,
            social_name: form.company_label,
            fantasy_name: null,
          } as ICompanyAPI)
        : null,
    [form.company_id, form.company_label],
  );

  function patch(changes: Partial<FormState>) {
    setForm((f) => ({ ...f, ...changes }));
  }
  function updateItem(index: number, changes: Partial<ItemRow>) {
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === index ? { ...it, ...changes } : it)),
    }));
  }
  function addItem() {
    setForm((f) => ({
      ...f,
      items: [
        ...f.items,
        {
          _key: `row-${keyCounter.current++}`,
          description: '',
          reference_code: '',
          unit: f.model === 'nf3e' ? 'kWh' : 'UN',
          unit_value: '',
          unit_tax_value: null,
        },
      ],
    }));
  }
  function removeItem(index: number) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }));
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        model: form.model,
        number: form.number,
        series: form.series,
        issued_at: form.issued_at,
        access_key: form.access_key,
        company_id: form.company_id,
        neighborhood: form.neighborhood,
        city: form.city,
        state: form.state,
        items: form.items.map((it) => ({
          id: it.id,
          description: it.description,
          reference_code: it.reference_code,
          unit: it.unit,
          unit_value: Number(it.unit_value.replace(',', '.')) || 0,
        })),
      };
      if (form.id) {
        return api.patch(`${API_URL_INVOICES}/${form.id}`, payload);
      }
      return api.post(API_URL_INVOICES, payload);
    },
    async onSuccess() {
      successFeedbackToast('Nota', `${isCreate ? 'Cadastrada' : 'Atualizada'} com sucesso!`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [TABLE_INVOICES] }),
        queryClient.invalidateQueries({ queryKey: [TABLE_INFLATION] }),
      ]);
      modalRef.current?.onCloseDialog();
    },
    onError(error: Error) {
      errorFeedbackToast('Nota', error);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`${API_URL_INVOICES}/${id}`),
    async onSuccess() {
      successFeedbackToast('Nota', 'Excluída com sucesso!');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [TABLE_INVOICES] }),
        queryClient.invalidateQueries({ queryKey: [TABLE_INFLATION] }),
      ]);
      modalRef.current?.onCloseDialog();
    },
    onError(error: Error) {
      errorFeedbackToast('Nota', error);
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      openWithEnergyDraft(draft: IEnergyDraft) {
        const next: FormState = {
          ...EMPTY,
          model: 'nf3e',
          access_key: draft.accessKey ?? '',
          issued_at: draft.issuedAt ?? '',
          items: draft.unitPriceKwh
            ? [
                {
                  _key: `row-${keyCounter.current++}`,
                  description: 'Consumo de energia elétrica',
                  reference_code: '0601000',
                  unit: 'kWh',
                  unit_value: String(draft.unitPriceKwh),
                  unit_tax_value: null,
                },
              ]
            : [],
        };
        setForm(next);
        baselineRef.current = JSON.stringify(next);
        modalRef.current?.onOpenDialog();
      },
      async onOpenDialog(invoiceId?: string) {
        if (!invoiceId) {
          setForm(EMPTY);
          baselineRef.current = JSON.stringify(EMPTY);
          modalRef.current?.onOpenDialog();
          return;
        }
        setLoading(true);
        setForm(EMPTY);
        baselineRef.current = JSON.stringify(EMPTY);
        modalRef.current?.onOpenDialog();
        try {
          const { data } = await api.get(`${API_URL_INVOICES}/${invoiceId}`);
          const d = data.data;
          const loaded: FormState = {
            id: d.id,
            model: d.model,
            number: d.number ?? '',
            series: d.series ?? '',
            issued_at: d.issued_at ? toDateInputValue(String(d.issued_at)) : '',
            access_key: d.access_key ?? '',
            company_id: d.company.id,
            company_label: d.company.fantasy_name || d.company.social_name,
            neighborhood: d.neighborhood ?? '',
            city: d.city ?? '',
            state: d.state ?? '',
            items: (d.items ?? []).map((it: Record<string, unknown>) => ({
              _key: `row-${keyCounter.current++}`,
              id: typeof it.id === 'string' ? it.id : undefined,
              description: String(it.description ?? ''),
              reference_code: String(it.reference_code ?? ''),
              unit: String(it.unit ?? ''),
              unit_value: String(it.unit_value ?? ''),
              unit_tax_value: it.unit_tax_value == null ? null : Number(it.unit_tax_value),
            })),
          };
          setForm(loaded);
          baselineRef.current = JSON.stringify(loaded);
        } catch (e) {
          errorFeedbackToast('Nota', e as Error);
          modalRef.current?.onCloseDialog();
        } finally {
          setLoading(false);
        }
      },
    }),
    [errorFeedbackToast],
  );

  const accent = isEnergy ? 'energy' : 'teal';
  const busy = saveMutation.isPending || removeMutation.isPending;

  return (
    <Modal
      ref={modalRef}
      size="xl"
      onSubmit={() => saveMutation.mutate()}
      onClose={() => setForm(EMPTY)}
      onOpenChange={setOpen}
      busy={busy}
    >
      <Dialog.Header>
        <HStack gap="3">
          <Circle size="10" bg={`${accent}.subtle`} color={`${accent}.fg`} colorPalette={accent}>
            <Icon as={isEnergy ? LuZap : LuFileText} boxSize={5} />
          </Circle>
          <Stack gap="0">
            <Dialog.Title fontSize="lg" fontFamily="heading">
              {isCreate
                ? isEnergy
                  ? 'Nova conta de energia'
                  : 'Nova nota fiscal'
                : isEnergy
                  ? 'Editar conta de energia'
                  : 'Editar nota fiscal'}
            </Dialog.Title>
            {!isCreate && form.access_key && (
              <Text fontSize="xs" color="fg.muted" fontFamily="mono">
                {maskAccessKey(form.access_key)}
              </Text>
            )}
          </Stack>
        </HStack>
      </Dialog.Header>

      <Dialog.Body>
        {loading ? (
          <LoadingState size="sm" label="Carregando nota…" />
        ) : (
          <Stack gap="5">
            <Stack gap="3">
              <SimpleGrid columns={{ base: 1, md: 4 }} gap="3">
                <Select
                  name="model"
                  label="Tipo de documento"
                  disabled={busy}
                  searchable={false}
                  options={MODEL_OPTIONS}
                  value={form.model}
                  onChange={(v) => patch({ model: (v ?? 'nfe') as Model })}
                />
                <Input
                  name="number"
                  label="Número"
                  disabled={busy}
                  value={form.number}
                  onChange={(e) => patch({ number: e.target.value })}
                />
                <Input
                  name="series"
                  label="Série"
                  disabled={busy}
                  value={form.series}
                  onChange={(e) => patch({ series: e.target.value })}
                />
                <Input
                  name="issued_at"
                  label="Data de emissão"
                  type="date"
                  disabled={busy}
                  value={form.issued_at}
                  onChange={(e) => patch({ issued_at: e.target.value })}
                />
              </SimpleGrid>

              {isCreate ? (
                <SelectWithService<ICompanyAPI>
                  name="company_id"
                  label={isEnergy ? 'Distribuidora (emitente)' : 'Emitente'}
                  disabled={busy}
                  clearable
                  optionLabel={(c) => c.fantasy_name || c.social_name}
                  orderBy="social_name"
                  onSearch={getCompanies}
                  value={selectedCompany}
                  onChange={(c) =>
                    patch({
                      company_id: c?.id ?? '',
                      company_label: c ? c.fantasy_name || c.social_name : '',
                    })
                  }
                />
              ) : (
                <Input
                  name="company"
                  label={isEnergy ? 'Distribuidora (emitente)' : 'Emitente'}
                  value={form.company_label}
                  disabled
                />
              )}

              <Text fontSize="xs" fontWeight="bold" color="fg.muted" letterSpacing="wide">
                {isEnergy ? 'LOCAL DE CONSUMO' : 'LOCAL DA COMPRA'} (para o índice regional)
              </Text>
              <SimpleGrid columns={{ base: 1, md: 3 }} gap="3">
                <Input
                  name="neighborhood"
                  label="Bairro"
                  disabled={busy}
                  value={form.neighborhood}
                  onChange={(e) => patch({ neighborhood: e.target.value })}
                />
                <Input
                  name="city"
                  label="Cidade"
                  disabled={busy}
                  value={form.city}
                  onChange={(e) => patch({ city: e.target.value })}
                />
                <Input
                  name="state"
                  label="Estado"
                  disabled={busy}
                  value={form.state}
                  onChange={(e) => patch({ state: e.target.value })}
                />
              </SimpleGrid>
            </Stack>

            <Stack gap="2">
              <Flex justify="space-between" align="center">
                <Text fontWeight="semibold" fontSize="sm">
                  Itens da {isEnergy ? 'fatura' : 'nota'} ({form.items.length})
                </Text>
                <SecondaryButton type="button" size="xs" disabled={busy} onClick={addItem}>
                  <LuPlus /> Adicionar item
                </SecondaryButton>
              </Flex>

              {form.items.length === 0 ? (
                <Text fontSize="sm" color="fg.muted" py="2">
                  Nenhum item. Use “Adicionar item” para incluir.
                </Text>
              ) : (
                <Stack gap="2">
                  {form.items.map((it, index) => (
                    <Flex key={it._key} gap="2" align="end">
                      <Box flex="1">
                        <Input
                          name={`desc-${index}`}
                          label={index === 0 ? 'Descrição' : undefined}
                          disabled={busy}
                          value={it.description}
                          onChange={(e) => updateItem(index, { description: e.target.value })}
                        />
                      </Box>
                      {!isEnergy && (
                        <Box w="32">
                          <Input
                            name={`ncm-${index}`}
                            label={index === 0 ? 'NCM' : undefined}
                            disabled={busy}
                            value={it.reference_code}
                            onChange={(e) =>
                              updateItem(index, {
                                reference_code: e.target.value,
                              })
                            }
                          />
                        </Box>
                      )}
                      <Box w="24">
                        <Input
                          name={`unit-${index}`}
                          label={index === 0 ? 'Unidade' : undefined}
                          disabled={busy}
                          value={it.unit}
                          onChange={(e) => updateItem(index, { unit: e.target.value })}
                        />
                      </Box>
                      <Box w="32">
                        <Input
                          name={`val-${index}`}
                          label={index === 0 ? (isEnergy ? 'R$/kWh' : 'Valor unit.') : undefined}
                          uppercase={false}
                          disabled={busy}
                          value={it.unit_value}
                          onChange={(e) => updateItem(index, { unit_value: e.target.value })}
                        />
                        {/* Só leitura: vem do <vTotTrib> do XML, não é editável. */}
                        {it.unit_tax_value != null && (
                          <Text fontSize="xs" color="fg.muted" mt="1">
                            trib. ≈ {formatPrice(it.unit_tax_value, 4)}
                          </Text>
                        )}
                      </Box>
                      <ActionIconButton
                        aria-label="Remover item"
                        colorPalette="red"
                        disabled={busy}
                        onClick={() => removeItem(index)}
                      >
                        <LuTrash2 />
                      </ActionIconButton>
                    </Flex>
                  ))}
                </Stack>
              )}
            </Stack>
            <HStack
              mb="-4"
              gap="2.5"
              align="center"
              bg="teal.50"
              _dark={{ bg: 'teal.950' }}
              p="2"
              borderRadius="lg"
            >
              <Icon as={LuShieldCheck} color="teal.600" boxSize={5} mt="0.5" flexShrink={0} />
              <Text fontSize="xs" color="fg.muted">
                {isEnergy
                  ? 'Privacidade: descartamos rua, número, CEP, unidade consumidora, medidor, titular e o consumo em kWh — guardamos só a distribuidora, o preço por kWh e bairro/cidade/UF.'
                  : 'Privacidade: dados pessoais do consumidor (CPF, nome, endereço) são descartados. Guardamos só o emitente, o valor unitário de cada item e o bairro/cidade/UF.'}
              </Text>
            </HStack>
          </Stack>
        )}
      </Dialog.Body>

      <Dialog.Footer justifyContent="space-between" gap="2">
        <Box>
          {!isCreate && (
            <SecondaryButton
              type="button"
              colorPalette="red"
              loading={removeMutation.isPending}
              disabled={saveMutation.isPending}
              onClick={() =>
                confirmRef.current?.open({
                  title: 'Excluir nota?',
                  description: 'Esta nota e seus itens sairão da sua análise de inflação.',
                  onConfirm: async () => {
                    if (form.id) {
                      await removeMutation.mutateAsync(form.id);
                    }
                  },
                })
              }
            >
              <LuTrash2 /> Excluir
            </SecondaryButton>
          )}
        </Box>
        <HStack gap="2">
          <SecondaryButton
            type="button"
            disabled={busy}
            onClick={() => modalRef.current?.onCloseDialog()}
          >
            Cancelar
          </SecondaryButton>
          <PrimaryButton
            type="submit"
            loading={saveMutation.isPending}
            disabled={removeMutation.isPending}
          >
            Salvar alterações
          </PrimaryButton>
        </HStack>
      </Dialog.Footer>

      <ConfirmDialog ref={confirmRef} />
    </Modal>
  );
}
