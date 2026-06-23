'use client';

import { Button, Input, SimpleGrid, Stack } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toaster } from '~/components/ui/toaster';

export interface ICompanyForm {
  id: string;
  social_name: string;
  fantasy_name: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zipcode: string;
}

export function CompanyEditForm({ company }: { company: ICompanyForm }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form.entries());
    const res = await fetch(`/api/companies/${company.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (res.ok) {
      toaster.create({ type: 'success', title: 'Empresa atualizada' });
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toaster.create({
        type: 'error',
        title: 'Falha ao salvar',
        description: data.error,
      });
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <Stack gap={4} maxW="2xl">
        <Input
          name="social_name"
          placeholder="Razão social"
          defaultValue={company.social_name}
          required
        />
        <Input
          name="fantasy_name"
          placeholder="Nome fantasia"
          defaultValue={company.fantasy_name}
        />
        <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
          <Input name="street" placeholder="Logradouro" defaultValue={company.street} />
          <Input name="number" placeholder="Número" defaultValue={company.number} />
          <Input name="neighborhood" placeholder="Bairro" defaultValue={company.neighborhood} />
          <Input name="city" placeholder="Cidade" defaultValue={company.city} />
          <Input name="state" placeholder="UF" maxLength={2} defaultValue={company.state} />
          <Input name="zipcode" placeholder="CEP" defaultValue={company.zipcode} />
        </SimpleGrid>
        <Button type="submit" loading={loading} alignSelf="start">
          Salvar
        </Button>
      </Stack>
    </form>
  );
}
