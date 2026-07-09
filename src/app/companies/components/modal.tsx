'use client';

import { Dialog, SimpleGrid, Stack } from '@chakra-ui/react';
import { useBeforeUnload } from '@julianobazzi/nextjs-utils';
import { revalidateLogic, useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { useSelector } from '@tanstack/react-store';
import { type Ref, useImperativeHandle, useRef, useState } from 'react';
import { PrimaryButton } from '~/components/Button/Base/PrimaryButton';
import { SecondaryButton } from '~/components/Button/Base/SecondaryButton';
import { Modal, type ModalHandle } from '~/components/Form/Modal';
import { Input } from '~/components/Input';
import { API_URL_COMPANIES, TABLE_COMPANIES } from '~/config/constants';
import { useFeedback } from '~/contexts/FeedbackContext';
import type ICompanyAPI from '~/models/Entity/Company/ICompanyAPI';
import { type CompanyData, type CompanyFormInput, companySchema } from '~/schemas/company';
import { api } from '~/services/apiClient';
import { queryClient } from '~/services/queryClient';

export type CompanyModalHandle = {
  onOpenDialog: (company?: ICompanyAPI) => void;
};

const EMPTY: CompanyFormInput = {
  document: '',
  social_name: '',
  fantasy_name: '',
  street: '',
  number: '',
  neighborhood: '',
  city: '',
  state: '',
  zipcode: '',
};

const ADDRESS_FIELDS = [
  ['zipcode', 'CEP'],
  ['street', 'Rua / Logradouro'],
  ['number', 'Número'],
  ['neighborhood', 'Bairro'],
  ['city', 'Cidade'],
  ['state', 'Estado'],
] as const;

export function CompanyModal({ ref }: { ref?: Ref<CompanyModalHandle> }) {
  const modalRef = useRef<ModalHandle>(null);
  const { successFeedbackToast, errorFeedbackToast } = useFeedback();
  const [editing, setEditing] = useState<ICompanyAPI | undefined>();
  const [open, setOpen] = useState(false);

  const isEditing = !!editing;

  const mutation = useMutation({
    mutationFn: async (data: CompanyData) => {
      if (editing) {
        const { document: _document, ...rest } = data;
        const response = await api.patch(`${API_URL_COMPANIES}/${editing.id}`, rest);
        return response.data;
      }
      const response = await api.post(API_URL_COMPANIES, data);
      return response.data;
    },
    async onSuccess() {
      successFeedbackToast('Empresa', `${isEditing ? 'Atualizada' : 'Cadastrada'} com sucesso!`);
      await queryClient.invalidateQueries({ queryKey: [TABLE_COMPANIES] });
      modalRef.current?.onCloseDialog();
    },
    onError(error: Error) {
      errorFeedbackToast('Empresa', error);
    },
  });

  const form = useForm({
    defaultValues: EMPTY,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: companySchema },
    onSubmit: ({ value }) => mutation.mutateAsync(companySchema.parse(value)),
  });

  const isSubmitting = useSelector(form.store, (state) => state.isSubmitting);
  const isDirty = useSelector(form.store, (state) => state.isDirty);

  useBeforeUnload(open && isDirty, 'Você tem alterações não salvas. Deseja mesmo sair?');

  useImperativeHandle(
    ref,
    () => ({
      onOpenDialog(company?: ICompanyAPI) {
        setEditing(company);
        form.reset(
          company
            ? {
                document: company.document ?? '',
                social_name: company.social_name ?? '',
                fantasy_name: company.fantasy_name ?? '',
                street: company.street ?? '',
                number: company.number ?? '',
                neighborhood: company.neighborhood ?? '',
                city: company.city ?? '',
                state: company.state ?? '',
                zipcode: company.zipcode ?? '',
              }
            : EMPTY,
        );
        modalRef.current?.onOpenDialog();
      },
    }),
    [form],
  );

  return (
    <Modal
      ref={modalRef}
      title={isEditing ? 'Editar empresa' : 'Nova empresa'}
      onSubmit={() => form.handleSubmit()}
      onOpenChange={setOpen}
      busy={isSubmitting}
      size="lg"
    >
      <Dialog.Body>
        <Stack gap="4">
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
            <form.Field name="document">
              {(field) => (
                <Input
                  name={field.name}
                  label="CNPJ"
                  placeholder="00.000.000/0000-00"
                  required={!isEditing}
                  disabled={isEditing || isSubmitting}
                  value={field.state.value ?? ''}
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
                  disabled={isSubmitting}
                  value={field.state.value ?? ''}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              )}
            </form.Field>
          </SimpleGrid>

          <form.Field name="social_name">
            {(field) => (
              <Input
                name={field.name}
                label="Razão social"
                required
                disabled={isSubmitting}
                value={field.state.value ?? ''}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]?.message}
              />
            )}
          </form.Field>

          <SimpleGrid columns={{ base: 1, md: 3 }} gap="4">
            {ADDRESS_FIELDS.map(([name, label]) => (
              <form.Field key={name} name={name}>
                {(field) => (
                  <Input
                    name={field.name}
                    label={label}
                    disabled={isSubmitting}
                    value={field.state.value ?? ''}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                )}
              </form.Field>
            ))}
          </SimpleGrid>
        </Stack>
      </Dialog.Body>
      <Dialog.Footer gap="2">
        <SecondaryButton
          type="button"
          disabled={isSubmitting}
          onClick={() => modalRef.current?.onCloseDialog()}
        >
          Cancelar
        </SecondaryButton>
        <PrimaryButton type="submit" loading={isSubmitting}>
          Salvar empresa
        </PrimaryButton>
      </Dialog.Footer>
    </Modal>
  );
}
