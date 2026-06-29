'use client';

import { CloseButton, Dialog, type DialogRootProps } from '@chakra-ui/react';
import {
  type FormEvent,
  type ReactNode,
  type Ref,
  useCallback,
  useImperativeHandle,
  useState,
} from 'react';

export interface IModalProps extends Omit<DialogRootProps, 'onOpenChange' | 'open' | 'children'> {
  title?: string;
  onSubmit?: () => void;
  onClose?: () => void;
  children: ReactNode;
  disableCloseButton?: boolean;
}

export type ModalHandle = {
  onOpenDialog: () => void;
  onCloseDialog: () => void;
};

export function Modal({
  title,
  children,
  disableCloseButton,
  onSubmit,
  onClose,
  ref,
  ...rest
}: IModalProps & { ref?: Ref<ModalHandle> }) {
  const [open, setOpen] = useState(false);

  const onOpenDialog = useCallback(() => setOpen(true), []);
  const onCloseDialog = useCallback(() => setOpen(false), []);

  function handleCloseDialog() {
    onClose?.();
    onCloseDialog();
  }

  useImperativeHandle(ref, () => ({ onOpenDialog, onCloseDialog }), [onOpenDialog, onCloseDialog]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(details) => {
        if (!details.open) handleCloseDialog();
      }}
      closeOnEscape={!disableCloseButton}
      closeOnInteractOutside={false}
      {...rest}
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content
          {...(onSubmit && {
            as: 'form',
            onSubmit: (event: FormEvent) => {
              event.preventDefault();
              onSubmit();
            },
          })}
        >
          {!disableCloseButton && (
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" onClick={handleCloseDialog} />
            </Dialog.CloseTrigger>
          )}
          {title && (
            <Dialog.Header>
              <Dialog.Title fontSize="xl" fontWeight="medium" color="teal.600">
                {title}
              </Dialog.Title>
            </Dialog.Header>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
