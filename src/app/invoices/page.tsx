import { Badge, Box, Link as CLink, Container, Stack, Table } from '@chakra-ui/react';
import { formatCNPJ, formatCurrency, formatDate } from '@julianobazzi/utils';
import NextLink from 'next/link';
import { redirect } from 'next/navigation';
import { AppHeader } from '~/components/AppHeader';
import { DeleteInvoiceButton } from '~/components/invoices/DeleteInvoiceButton';
import { InvoiceFilters } from '~/components/invoices/InvoiceFilters';
import { Pagination } from '~/components/invoices/Pagination';
import { getSession } from '~/lib/auth/current-user';
import { fromCents } from '~/lib/money';
import { listInvoices } from '~/services/invoice/queries';

function parseType(v?: string): 'nfe' | 'nfse' | undefined {
  return v === 'nfe' || v === 'nfse' ? v : undefined;
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const { rows, total, pageSize } = await listInvoices({
    userId: session.sub,
    type: parseType(sp.type),
    from: sp.from ? new Date(sp.from) : undefined,
    to: sp.to ? new Date(sp.to) : undefined,
    search: sp.search || undefined,
    page,
  });

  return (
    <Box minH="100dvh">
      <Container maxW="5xl" py={{ base: 4, md: 8 }}>
        <AppHeader />

        <Stack gap={4}>
          <InvoiceFilters />

          {rows.length === 0 ? (
            <Box color="fg.muted">Nenhuma nota encontrada.</Box>
          ) : (
            <Table.Root size="sm" variant="outline">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Empresa</Table.ColumnHeader>
                  <Table.ColumnHeader>CNPJ</Table.ColumnHeader>
                  <Table.ColumnHeader>Tipo</Table.ColumnHeader>
                  <Table.ColumnHeader>Data</Table.ColumnHeader>
                  <Table.ColumnHeader>Itens</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Total</Table.ColumnHeader>
                  <Table.ColumnHeader />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {rows.map((invoice) => (
                  <Table.Row key={invoice.id}>
                    <Table.Cell>
                      <CLink asChild>
                        <NextLink href={`/invoices/${invoice.id}`}>
                          {invoice.company.fantasy_name || invoice.company.social_name}
                        </NextLink>
                      </CLink>
                    </Table.Cell>
                    <Table.Cell>{formatCNPJ(invoice.company.document)}</Table.Cell>
                    <Table.Cell>
                      <Badge colorPalette={invoice.model === 'nfe' ? 'blue' : 'purple'}>
                        {invoice.model === 'nfe' ? 'Produto' : 'Serviço'}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>{formatDate(invoice.issued_at.toISOString())}</Table.Cell>
                    <Table.Cell>{invoice._count.items}</Table.Cell>
                    <Table.Cell textAlign="end">
                      {formatCurrency(fromCents(invoice.total_value))}
                    </Table.Cell>
                    <Table.Cell textAlign="end">
                      <DeleteInvoiceButton id={invoice.id} />
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          )}

          <Pagination page={page} pageSize={pageSize} total={total} />
        </Stack>
      </Container>
    </Box>
  );
}
