import { Box, Container } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { Header } from '~/components/Template/Header';

export interface ITemplateProps {
  children: ReactNode;
}

export default function Template({ children }: ITemplateProps) {
  return (
    <Box
      minH="100dvh"
      bgGradient="to-b"
      gradientFrom={{ base: 'teal.50', _dark: 'gray.950' }}
      gradientTo={{ base: 'bg', _dark: 'gray.900' }}
    >
      <Header />
      <Container maxW="full" px={{ base: 4, md: 6 }} pb={{ base: 8, md: 12 }}>
        {children}
      </Container>
    </Box>
  );
}
