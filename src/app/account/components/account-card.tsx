'use client';

import { Card, Heading, Stack, Text } from '@chakra-ui/react';
import { revalidateLogic, useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { useSelector } from '@tanstack/react-store';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import { SecondaryButton } from '~/components/Button/Base/SecondaryButton';
import { ConfirmDialog, type ConfirmDialogHandle } from '~/components/Form/ConfirmDialog';
import { Input } from '~/components/Input';
import { PasswordInput } from '~/components/Input/PasswordInput';
import { API_URL_ACCOUNT } from '~/config/constants';
import { useFeedback } from '~/contexts/FeedbackContext';
import { logout } from '~/lib/auth/client-session';
import { changePasswordSchema, updateAccountSchema } from '~/schemas/account';
import { api } from '~/services/apiClient';

export function AccountCard({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const { successFeedbackToast, errorFeedbackToast } = useFeedback();
  const confirmRef = useRef<ConfirmDialogHandle>(null);

  const nameMutation = useMutation({
    mutationFn: (value: { name: string }) => api.patch(API_URL_ACCOUNT, value),
    async onSuccess() {
      successFeedbackToast('Conta', 'Nome atualizado com sucesso!');
      router.refresh();
    },
    onError: (error: Error) => errorFeedbackToast('Conta', error),
  });

  const passwordMutation = useMutation({
    mutationFn: (value: { currentPassword: string; newPassword: string }) =>
      api.post(`${API_URL_ACCOUNT}/password`, value),
    onSuccess() {
      successFeedbackToast('Conta', 'Senha alterada com sucesso!');
      passwordForm.reset();
    },
    onError: (error: Error) => errorFeedbackToast('Conta', error),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(API_URL_ACCOUNT),
    onSuccess() {
      return logout();
    },
    onError: (error: Error) => errorFeedbackToast('Conta', error),
  });

  const nameForm = useForm({
    defaultValues: { name },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: updateAccountSchema },
    onSubmit: ({ value }) => nameMutation.mutateAsync(updateAccountSchema.parse(value)),
  });

  const passwordForm = useForm({
    defaultValues: { currentPassword: '', newPassword: '' },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: changePasswordSchema },
    onSubmit: ({ value }) => passwordMutation.mutateAsync(changePasswordSchema.parse(value)),
  });

  const nameSaving = useSelector(nameForm.store, (s) => s.isSubmitting);
  const passwordSaving = useSelector(passwordForm.store, (s) => s.isSubmitting);

  function confirmDelete() {
    confirmRef.current?.open({
      title: 'Excluir sua conta?',
      description:
        'Esta ação encerra sua sessão e desativa sua conta. Você não conseguirá mais entrar com este e-mail.',
      confirmLabel: 'Excluir conta',
      onConfirm: async () => {
        await deleteMutation.mutateAsync();
      },
    });
  }

  return (
    <Stack gap="6" maxW="2xl">
      <Stack gap="0.5">
        <Heading size="lg" fontFamily="heading">
          Minha conta
        </Heading>
        <Text fontSize="sm" color="fg.muted">
          Gerencie seus dados de acesso.
        </Text>
      </Stack>

      <Card.Root bg="bg.surface">
        <Card.Body>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              nameForm.handleSubmit();
            }}
          >
            <Stack gap="4">
              <Heading size="sm" fontFamily="heading">
                Perfil
              </Heading>
              <nameForm.Field name="name">
                {(field) => (
                  <Input
                    name={field.name}
                    label="Nome"
                    required
                    disabled={nameSaving}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    error={field.state.meta.errors[0]?.message}
                  />
                )}
              </nameForm.Field>
              <Input name="email" label="E-mail" value={email} disabled readOnly />
              <PrimaryButton type="submit" loading={nameSaving} alignSelf="start">
                Salvar nome
              </PrimaryButton>
            </Stack>
          </form>
        </Card.Body>
      </Card.Root>

      <Card.Root bg="bg.surface">
        <Card.Body>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              passwordForm.handleSubmit();
            }}
          >
            <Stack gap="4">
              <Heading size="sm" fontFamily="heading">
                Trocar senha
              </Heading>
              <passwordForm.Field name="currentPassword">
                {(field) => (
                  <PasswordInput
                    name={field.name}
                    label="Senha atual"
                    required
                    autoComplete="current-password"
                    disabled={passwordSaving}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    error={field.state.meta.errors[0]?.message}
                  />
                )}
              </passwordForm.Field>
              <passwordForm.Field name="newPassword">
                {(field) => (
                  <PasswordInput
                    name={field.name}
                    label="Nova senha"
                    required
                    autoComplete="new-password"
                    disabled={passwordSaving}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    error={field.state.meta.errors[0]?.message}
                  />
                )}
              </passwordForm.Field>
              <PrimaryButton type="submit" loading={passwordSaving} alignSelf="start">
                Alterar senha
              </PrimaryButton>
            </Stack>
          </form>
        </Card.Body>
      </Card.Root>

      <Card.Root borderColor="red.200" _dark={{ borderColor: 'red.900' }}>
        <Card.Body>
          <Stack gap="3">
            <Heading size="sm" fontFamily="heading" color="fg.error">
              Zona de perigo
            </Heading>
            <Text fontSize="sm" color="fg.muted">
              Excluir sua conta desativa o acesso e encerra a sessão. Esta ação não pode ser
              desfeita.
            </Text>
            <SecondaryButton
              colorPalette="red"
              alignSelf="start"
              loading={deleteMutation.isPending}
              onClick={confirmDelete}
            >
              Excluir conta
            </SecondaryButton>
          </Stack>
        </Card.Body>
      </Card.Root>

      <ConfirmDialog ref={confirmRef} />
    </Stack>
  );
}
