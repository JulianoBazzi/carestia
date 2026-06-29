'use client';

import { Button } from '@chakra-ui/react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { API_URL_INVOICES, TABLE_INVOICES } from '~/config/constants';
import { useFeedback } from '~/contexts/FeedbackContext';
import { api } from '~/services/apiClient';
import { queryClient } from '~/services/queryClient';

export function DeleteInvoiceButton({
  id,
  redirectTo,
  size = 'xs',
}: {
  id: string;
  redirectTo?: string;
  size?: 'xs' | 'sm';
}) {
  const router = useRouter();
  const { successFeedbackToast, errorFeedbackToast } = useFeedback();

  const mutation = useMutation({
    mutationFn: () => api.delete(`${API_URL_INVOICES}/${id}`),
    async onSuccess() {
      successFeedbackToast('Nota', 'Excluída com sucesso!');
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        await queryClient.invalidateQueries({ queryKey: [TABLE_INVOICES] });
      }
    },
    onError(error: Error) {
      errorFeedbackToast('Nota', error);
    },
  });

  return (
    <Button
      size={size}
      variant="outline"
      colorPalette="red"
      loading={mutation.isPending}
      onClick={() => {
        if (window.confirm('Excluir esta nota?')) mutation.mutate();
      }}
    >
      Excluir
    </Button>
  );
}
