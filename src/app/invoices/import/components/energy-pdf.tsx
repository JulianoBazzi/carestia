'use client';

import { Card, Circle, Flex, Icon, Stack, Text } from '@chakra-ui/react';
import { useRef, useState } from 'react';
import { LuZap } from 'react-icons/lu';
import { InvoiceModal, type InvoiceModalHandle } from '~/app/invoices/components/modal';
import { SecondaryButton } from '~/components/Button/Base/SecondaryButton';
import { API_URL_INVOICES } from '~/config/constants';
import { useFeedback } from '~/contexts/FeedbackContext';
import { api } from '~/services/apiClient';

export function EnergyPdfImport() {
  const modalRef = useRef<InvoiceModalHandle>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const { successFeedbackToast, errorFeedbackToast } = useFeedback();

  async function onFile(file: File) {
    setLoading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post(`${API_URL_INVOICES}/import-pdf`, form);
      const draft = data.data;
      successFeedbackToast(
        'Conta de energia',
        'Dados extraídos — revise e complete antes de salvar.',
      );
      modalRef.current?.openWithEnergyDraft({
        accessKey: draft.accessKey,
        issuedAt: draft.issuedAt,
        unitPriceKwh: draft.unitPriceKwh,
        distribuidora: draft.distribuidora,
      });
    } catch (e) {
      errorFeedbackToast('Conta de energia', e as Error);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <Card.Root bg="bg.surface">
      <Card.Body>
        <Flex justify="space-between" align="center" gap="4" wrap="wrap">
          <Flex gap="3" align="center">
            <Circle size="10" bg="energy.subtle" color="energy.fg" colorPalette="energy">
              <Icon as={LuZap} boxSize={5} />
            </Circle>
            <Stack gap="0.5">
              <Text fontWeight="semibold">Importar conta de energia (PDF)</Text>
              <Text fontSize="sm" color="fg.muted" maxW="2xl">
                Envie o PDF da conta (DANF3e). Lemos o que for possível (distribuidora, chave,
                R$/kWh) e abrimos o formulário para você revisar e completar. Contas escaneadas
                podem exigir preenchimento manual.
              </Text>
            </Stack>
          </Flex>
          <SecondaryButton loading={loading} onClick={() => inputRef.current?.click()}>
            <LuZap /> Selecionar PDF
          </SecondaryButton>
        </Flex>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </Card.Body>
      <InvoiceModal ref={modalRef} />
    </Card.Root>
  );
}
