import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// O app Next carrega `.env.local` automaticamente, mas a CLI do Prisma não.
// Carregamos `.env.local` primeiro (tem prioridade) e `.env` como fallback.
config({ path: '.env.local', quiet: true });
config({ quiet: true });

// process.env (não o helper env()) pra `prisma generate` não exigir DATABASE_URL.
// db:push / db:migrate leem a URL real do .env quando definida.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
