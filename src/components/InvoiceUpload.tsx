'use client';

import { Box, Input, Stack, Text } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toaster } from '~/components/ui/toaster';

export function InvoiceUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  async function send(files: FileList) {
    setLoading(true);
    const form = new FormData();
    for (const file of Array.from(files)) {
      form.append('file', file);
    }
    const res = await fetch('/api/invoices/import', {
      method: 'POST',
      body: form,
    });
    setLoading(false);

    if (res.ok) {
      const { summary } = await res.json();
      toaster.create({
        type: summary.errors > 0 ? 'warning' : 'success',
        title: 'Importação concluída',
        description: `${summary.imported} importada(s) · ${summary.duplicated} duplicada(s) · ${summary.errors} erro(s)`,
      });
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toaster.create({
        type: 'error',
        title: 'Falha ao importar',
        description: data.error ?? 'Erro desconhecido.',
      });
    }
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <Box borderWidth="1px" borderRadius="md" p={4}>
      <Stack gap={3}>
        <Text fontWeight="medium">Importar XML / ZIP (NF-e / NFC-e / NFS-e)</Text>
        <Input
          ref={inputRef}
          type="file"
          accept=".xml,.zip,text/xml,application/xml,application/zip"
          multiple
          disabled={loading}
          p={1}
          onChange={(e) => {
            if (e.target.files?.length) send(e.target.files);
          }}
        />
        {loading && <Text fontSize="sm">Importando…</Text>}
      </Stack>
    </Box>
  );
}
