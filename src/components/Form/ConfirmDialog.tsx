'use client';

import { Button, Circle, Dialog, Portal, Stack, Text } from '@chakra-ui/react';
import { type ReactNode, type Ref, useImperativeHandle, useRef, useState } from 'react';
import { LuTriangleAlert } from 'react-icons/lu';

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
}

export type ConfirmDialogHandle = {
  open: (options: ConfirmOptions) => void;
};

/**
 * Diálogo de confirmação destrutiva reutilizável (modal "Excluir" do design):
 * ícone de aviso, título, descrição e ações Cancelar/Confirmar. Substitui o
 * `window.confirm` nas ações de exclusão. Uso:
 *
 *   const ref = useRef<ConfirmDialogHandle>(null);
 *   ref.current?.open({ title: 'Excluir?', onConfirm: () => mutation.mutate(id) });
 */
export function ConfirmDialog({ ref }: { ref?: Ref<ConfirmDialogHandle> }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const optsRef = useRef<ConfirmOptions | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      open(options: ConfirmOptions) {
        optsRef.current = options;
        setOpen(true);
      },
    }),
    [],
  );

  async function handleConfirm() {
    const opts = optsRef.current;
    if (!opts) {
      return;
    }
    try {
      setLoading(true);
      await opts.onConfirm();
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  const opts = optsRef.current;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(d) => !loading && setOpen(d.open)}
      role="alertdialog"
      placement="center"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="sm">
            <Dialog.Body pt={8}>
              <Stack align="center" textAlign="center" gap={3}>
                <Circle size="12" bg="red.50" color="red.500" _dark={{ bg: 'red.950' }}>
                  <LuTriangleAlert size={24} />
                </Circle>
                <Dialog.Title fontSize="lg" fontWeight="semibold">
                  {opts?.title}
                </Dialog.Title>
                {opts?.description && (
                  <Text fontSize="sm" color="fg.muted">
                    {opts.description}
                  </Text>
                )}
              </Stack>
            </Dialog.Body>
            <Dialog.Footer gap={2} justifyContent="center" pb={6}>
              <Button variant="outline" disabled={loading} onClick={() => setOpen(false)}>
                {opts?.cancelLabel ?? 'Cancelar'}
              </Button>
              <Button colorPalette="red" loading={loading} onClick={handleConfirm}>
                {opts?.confirmLabel ?? 'Excluir'}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
