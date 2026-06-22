import { Box, Container, Flex, Heading, Text } from "@chakra-ui/react";
import { ColorModeButton } from "@/components/ui/color-mode";

export default function HomePage() {
  return (
    <Box minH="100dvh">
      <Container maxW="3xl" py={{ base: 8, md: 16 }}>
        <Flex justify="space-between" align="center" mb={8}>
          <Heading size="2xl">Minha Inflação</Heading>
          <ColorModeButton />
        </Flex>
        <Text color="fg.muted" fontSize="lg">
          Acompanhe a inflação do seu próprio bolso. Estrutura base pronta.
        </Text>
      </Container>
    </Box>
  );
}
