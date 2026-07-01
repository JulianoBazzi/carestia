import { Box, Container } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { Header } from '~/components/Template/Header';
import { getSession } from '~/lib/auth/current-user';

export interface ITemplateProps {
  children: ReactNode;
}

export default async function Template({ children }: ITemplateProps) {
  const session = await getSession();
  const user = { name: session?.name ?? '', email: session?.email ?? '' };

  return (
    <Box minH="100dvh" bg="bg.app">
      <Header user={user} />
      <Container maxW="full" px={{ base: 4, md: 6 }} pb={{ base: 8, md: 12 }}>
        {children}
      </Container>
    </Box>
  );
}
