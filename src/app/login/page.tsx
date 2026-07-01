'use client';

import { Link as CLink, Stack, Text } from '@chakra-ui/react';
import { revalidateLogic, useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { useSelector } from '@tanstack/react-store';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthShell } from '~/components/auth/AuthShell';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import { Input, PasswordInput } from '~/components/Input';
import { useFeedback } from '~/contexts/FeedbackContext';
import { type LoginInput, loginSchema } from '~/schemas/auth';
import { api } from '~/services/apiClient';

export default function LoginPage() {
  const router = useRouter();
  const { errorFeedbackToast } = useFeedback();

  const mutation = useMutation({
    mutationFn: (data: LoginInput) => api.post('/api/auth/login', data),
    onSuccess() {
      router.replace('/dashboard');
      router.refresh();
    },
    onError(error: Error) {
      errorFeedbackToast('Entrar', error);
    },
  });

  const form = useForm({
    defaultValues: { email: '', password: '' } as LoginInput,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: loginSchema },
    onSubmit: ({ value }) => mutation.mutateAsync(loginSchema.parse(value)),
  });

  const isSubmitting = useSelector(form.store, (state) => state.isSubmitting);

  return (
    <AuthShell
      title="Entrar"
      subtitle="Acesse sua conta para acompanhar sua inflação"
      brandHeadline="Bem-vindo de volta"
      brandSubtitle="Acompanhe a inflação do seu próprio bolso e compare com o IPCA oficial."
      bullets={[
        'Importe suas NF-e, NFC-e e NFS-e em segundos',
        'Compare seus gastos com a inflação oficial (IPCA)',
        'Acompanhe a inflação por item e categoria',
      ]}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <Stack gap={4}>
          <form.Field name="email">
            {(field) => (
              <Input
                name={field.name}
                type="email"
                placeholder="E-mail"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]?.message}
              />
            )}
          </form.Field>
          <form.Field name="password">
            {(field) => (
              <PasswordInput
                name={field.name}
                placeholder="Senha"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]?.message}
              />
            )}
          </form.Field>
          <PrimaryButton type="submit" loading={isSubmitting} w="full">
            Entrar
          </PrimaryButton>
          <Text fontSize="sm" color="fg.muted" textAlign="center">
            Não tem uma conta?{' '}
            <CLink asChild color="teal.600" fontWeight="medium">
              <NextLink href="/register">Criar conta</NextLink>
            </CLink>
          </Text>
        </Stack>
      </form>
    </AuthShell>
  );
}
