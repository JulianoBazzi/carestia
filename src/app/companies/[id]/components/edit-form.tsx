'use client';

import { Card, Heading, HStack, Icon, SimpleGrid, Stack } from '@chakra-ui/react';
import { revalidateLogic, useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { useSelector } from '@tanstack/react-store';
import { LuBuilding2, LuMapPin, LuSave } from 'react-icons/lu';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import { Input } from '~/components/Input';
import { API_URL_COMPANIES, TABLE_COMPANIES } from '~/config/constants';
import { useFeedback } from '~/contexts/FeedbackContext';
import { type CompanyData, type CompanyFormInput, companySchema } from '~/schemas/company';
import { api } from '~/services/apiClient';
import { queryClient } from '~/services/queryClient';

export interface ICompanyEditFormProps {
  id: string;
  defaults: CompanyFormInput;
}

export function CompanyEditForm({ id, defaults }: ICompanyEditFormProps) {
  const { successFeedbackToast, errorFeedbackToast } = useFeedback();

  const mutation = useMutation({
    mutationFn: (data: CompanyData) => api.patch(`${API_URL_COMPANIES}/${id}`, data),
    async onSuccess() {
      successFeedbackToast('Empresa', 'Atualizada com sucesso!');
      await queryClient.invalidateQueries({ queryKey: [TABLE_COMPANIES] });
    },
    onError(error: Error) {
      errorFeedbackToast('Empresa', error);
    },
  });

  const form = useForm({
    defaultValues: defaults,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: companySchema },
    onSubmit: ({ value }) => mutation.mutateAsync(companySchema.parse(value)),
  });

  const isSubmitting = useSelector(form.store, (state) => state.isSubmitting);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <Stack gap={6}>
        <Card.Root>
          <Card.Body>
            <Stack gap={4}>
              <HStack gap={2}>
                <Icon color="teal.500">
                  <LuBuilding2 />
                </Icon>
                <Heading size="sm">Identificação</Heading>
              </HStack>
              <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                <form.Field name="social_name">
                  {(field) => (
                    <Input
                      name={field.name}
                      label="Razão social"
                      required
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      error={field.state.meta.errors[0]?.message}
                    />
                  )}
                </form.Field>
                <form.Field name="fantasy_name">
                  {(field) => (
                    <Input
                      name={field.name}
                      label="Nome fantasia"
                      value={field.state.value ?? ''}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                  )}
                </form.Field>
              </SimpleGrid>
            </Stack>
          </Card.Body>
        </Card.Root>

        <Card.Root>
          <Card.Body>
            <Stack gap={4}>
              <HStack gap={2}>
                <Icon color="teal.500">
                  <LuMapPin />
                </Icon>
                <Heading size="sm">Endereço</Heading>
              </HStack>
              <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                {(
                  [
                    ['street', 'Logradouro'],
                    ['number', 'Número'],
                    ['neighborhood', 'Bairro'],
                    ['city', 'Cidade'],
                    ['state', 'UF'],
                    ['zipcode', 'CEP'],
                  ] as const
                ).map(([name, label]) => (
                  <form.Field key={name} name={name}>
                    {(field) => (
                      <Input
                        name={field.name}
                        label={label}
                        value={field.state.value ?? ''}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                    )}
                  </form.Field>
                ))}
              </SimpleGrid>
            </Stack>
          </Card.Body>
        </Card.Root>

        <PrimaryButton
          type="submit"
          loading={isSubmitting}
          w={{ base: 'full', sm: 'auto' }}
          alignSelf={{ base: 'stretch', sm: 'start' }}
        >
          <LuSave /> Salvar
        </PrimaryButton>
      </Stack>
    </form>
  );
}
