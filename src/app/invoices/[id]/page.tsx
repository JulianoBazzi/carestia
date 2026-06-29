import {
  Badge,
  Box,
  Card,
  Link as CLink,
  Flex,
  Heading,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from '@chakra-ui/react';
import { formatCNPJ, formatCurrency, formatDate } from '@julianobazzi/utils';
import NextLink from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { DeleteInvoiceButton } from '~/components/invoices/DeleteInvoiceButton';
import Template from '~/components/Template';
import { getSession } from '~/lib/auth/current-user';
import { getInvoice } from '~/services/invoice/queries';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Text fontSize="xs" color="fg.muted">
        {label}
      </Text>
      <Text>{value}</Text>
    </Box>
  );
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { id } = await params;
  const invoice = await getInvoice(session.sub, id);
  if (!invoice) notFound();

  return (
    <Template>
      <Stack gap={6}>
        <Card.Root>
          <Card.Body>
            <Flex justify="space-between" align="start" mb={4} gap={4}>
              <Box>
                <Heading size="md">
                  {invoice.company.fantasy_name || invoice.company.social_name}
                </Heading>
                <Text color="fg.muted" fontSize="sm">
                  {formatCNPJ(invoice.company.document)}
                </Text>
                <CLink asChild fontSize="xs">
                  <NextLink href={`/companies/${invoice.company.id}`}>Editar empresa</NextLink>
                </CLink>
              </Box>
              <Badge colorPalette={invoice.model === 'nfe' ? 'blue' : 'purple'}>
                {invoice.model === 'nfe' ? 'Produto' : 'Serviço'}
              </Badge>
            </Flex>

            <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
              <Field label="Número" value={invoice.number} />
              <Field label="Série" value={invoice.series ?? '—'} />
              <Field label="Emissão" value={formatDate(invoice.issued_at.toISOString())} />
              <Field label="Total" value={formatCurrency(invoice.total_value)} />
            </SimpleGrid>
          </Card.Body>
        </Card.Root>

        <Table.Root size="sm" variant="outline">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Item</Table.ColumnHeader>
              <Table.ColumnHeader>Ref</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Qtd</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Unitário</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Total</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {invoice.items.map((line) => (
              <Table.Row key={line.id}>
                <Table.Cell>{line.description}</Table.Cell>
                <Table.Cell>
                  {line.item.reference_code}
                  {line.unit ? ` · ${line.unit}` : ''}
                </Table.Cell>
                <Table.Cell textAlign="end">{Number(line.quantity)}</Table.Cell>
                <Table.Cell textAlign="end">{formatCurrency(line.unit_value)}</Table.Cell>
                <Table.Cell textAlign="end">{formatCurrency(line.total_value)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>

        <Flex justify="end">
          <DeleteInvoiceButton id={invoice.id} redirectTo="/invoices" size="sm" />
        </Flex>
      </Stack>
    </Template>
  );
}
