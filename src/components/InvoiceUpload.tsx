'use client';

import { Card, HStack, Icon, Input, Stack, Text } from '@chakra-ui/react';
import { useMutation } from '@tanstack/react-query';
import { useRef } from 'react';
import { LuUpload } from 'react-icons/lu';
import {
  API_URL_INVOICES,
  TABLE_DASHBOARD_METRICS,
  TABLE_INFLATION,
  TABLE_INVOICES,
} from '~/config/constants';
import { useFeedback } from '~/contexts/FeedbackContext';
import { api } from '~/services/apiClient';
import { queryClient } from '~/services/queryClient';

interface IImportSummary {
  imported: number;
  duplicated: number;
  errors: number;
}

export function InvoiceUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { successFeedbackToast, warningFeedbackToast, errorFeedbackToast } = useFeedback();

  const mutation = useMutation({
    mutationFn: async (files: FileList) => {
      const form = new FormData();
      for (const file of Array.from(files)) form.append('file', file);
      const { data } = await api.post<{ summary: IImportSummary }>(
        `${API_URL_INVOICES}/import`,
        form,
      );
      return data.summary;
    },
    async onSuccess(summary) {
      const description = `${summary.imported} importada(s) · ${summary.duplicated} duplicada(s) · ${summary.errors} erro(s)`;
      if (summary.errors > 0) warningFeedbackToast('Importação concluída', description);
      else successFeedbackToast('Importação concluída', description);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [TABLE_INVOICES] }),
        queryClient.invalidateQueries({ queryKey: [TABLE_DASHBOARD_METRICS] }),
        queryClient.invalidateQueries({ queryKey: [TABLE_INFLATION] }),
      ]);
    },
    onError(error: Error) {
      errorFeedbackToast('Falha ao importar', error);
    },
    onSettled() {
      if (inputRef.current) inputRef.current.value = '';
    },
  });

  return (
    <Card.Root>
      <Card.Body>
        <Stack gap={3}>
          <HStack gap={2}>
            <Icon as={LuUpload} color="teal.500" />
            <Text fontWeight="medium">Importar XML / ZIP (NF-e / NFC-e / NFS-e)</Text>
          </HStack>
          <Input
            ref={inputRef}
            type="file"
            accept=".xml,.zip,text/xml,application/xml,application/zip"
            autoComplete="off"
            multiple
            disabled={mutation.isPending}
            p={1}
            onChange={(e) => {
              if (e.target.files?.length) mutation.mutate(e.target.files);
            }}
          />
          {mutation.isPending && <Text fontSize="sm">Importando…</Text>}
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}
