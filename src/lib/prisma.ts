import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '~/generated/prisma/client';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  // A importação de notas resolve linhas em paralelo (até ~15 queries
  // simultâneas com 3 requests em voo); o default do pg (10) enfileirava.
  max: 20,
  // Sem isto a espera por conexão livre é infinita — melhor um erro claro.
  connectionTimeoutMillis: 10_000,
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    // Banco remoto: os 5s/2s padrão eram estourados por fluxos com várias
    // queries (importação de notas). As transações do app são curtas hoje;
    // isto é rede de segurança, não licença para transações longas.
    transactionOptions: { maxWait: 10_000, timeout: 30_000 },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
