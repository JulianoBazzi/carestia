import "dotenv/config";
import { defineConfig } from "prisma/config";

// process.env (não o helper env()) pra `prisma generate` não exigir DATABASE_URL.
// db:push / db:migrate leem a URL real do .env quando definida.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
