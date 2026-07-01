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
import { type RegisterInput, registerSchema } from '~/schemas/auth';
import { api } from '~/services/apiClient';

export default function RegisterPage() {
  const router = useRouter();
  const { errorFeedbackToast } = useFeedback();

  const mutation = useMutation({
    mutationFn: (data: RegisterInput) => api.post('/api/auth/register', data),
    onSuccess() {
      router.replace('/dashboard');
      router.refresh();
    },
    onError(error: Error) {
      errorFeedbackToast('Cadastrar', error);
    },
  });

  const form = useForm({
    defaultValues: { name: '', email: '', password: '' } as RegisterInput,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: registerSchema },
    onSubmit: ({ value }) => mutation.mutateAsync(registerSchema.parse(value)),
  });

  const isSubmitting = useSelector(form.store, (state) => state.isSubmitting);

  return (
    <AuthShell
      title="Criar conta"
      subtitle="É grátis e leva menos de um minuto"
      brandHeadline="Descubra a sua inflação real"
      brandSubtitle="Importe suas NF-e, NFC-e e NFS-e e compare seus gastos com o IPCA oficial."
      bullets={[
        'Importe suas notas (NF-e, NFC-e, NFS-e) em segundos',
        'Compare seus gastos com a inflação oficial (IPCA)',
        'Acompanhe a inflação por item, loja e categoria',
      ]}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <Stack gap={4}>
          <form.Field name="name">
            {(field) => (
              <Input
                name={field.name}
                placeholder="Nome"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]?.message}
              />
            )}
          </form.Field>
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
                autoComplete="new-password"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]?.message}
              />
            )}
          </form.Field>
          <PrimaryButton type="submit" loading={isSubmitting} w="full">
            Criar conta
          </PrimaryButton>
          <Text fontSize="sm" color="fg.muted" textAlign="center">
            Já tem conta?{' '}
            <CLink asChild color="teal.600" fontWeight="medium">
              <NextLink href="/login">Entrar</NextLink>
            </CLink>
          </Text>
        </Stack>
      </form>
    </AuthShell>
  );
}
