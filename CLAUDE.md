# CLAUDE.md

Guia para agentes que trabalham neste repositório. Mantenha as convenções abaixo.

## O que é

**Carestia** — app Next.js (domínio: carestia.com.br) que permite ao usuário acompanhar a **própria inflação** importando notas fiscais eletrônicas (NF-e/NFC-e/NFS-e/NF3e) e comparando o índice pessoal com o **IPCA** oficial (BCB SGS série 433).

**Privacidade em primeiro lugar:** o banco armazena apenas o **preço unitário** de cada item (R$/un, ou R$/kWh para energia). Nunca guarde quantidade, valor total, XML bruto ou dados do consumidor. A agregação pública (`public-prices.ts`) só expõe médias com `MIN_SAMPLES = 3`.

## Comandos

```bash
pnpm dev            # Next.js dev (webpack, não Turbopack)
pnpm build          # build de produção (webpack)
pnpm lint           # biome check .
pnpm format         # biome check --write .  (aplica correções)
pnpm test           # vitest (watch)
pnpm test:run       # vitest run (CI)
pnpm db:push        # aplica o schema no Postgres (workflow baseado em push)
pnpm db:seed        # popula categorias padrão (idempotente)
pnpm db:studio      # Prisma Studio
```

Gerenciador de pacotes é **pnpm** (não use npm/yarn). `postinstall` roda `prisma generate`.

## Convenções

- **Import alias:** sempre importe via `~/` (mapeia para `src/`). Nunca use `./` ou `../` para caminhos internos. Ex.: `import { prisma } from '~/lib/prisma'`.
- **Formatação (Biome):** aspas **simples**, `;` sempre, indentação de 2 espaços, `lineWidth` 100. Rode `pnpm format` antes de finalizar. Não altere o estilo de aspas de um arquivo manualmente — deixe o Biome cuidar disso.
- **Chaves no `if`:** sempre use bloco com chaves, mesmo em uma linha. Nunca `if (x) return y;` — escreva `if (x) {\n  return y;\n}`. Vale para `else`/`for`/`while` também.
- **IDs:** ULID (`VarChar(26)`), gerados em `~/lib/id.ts`.
- **Soft delete:** entidades usam `deleted_at`; filtre registros removidos nas queries.
- **Validação:** schemas Zod em `src/schemas/`.
- **Prisma:** client gerado em `src/generated/prisma` (fora do lint/tsconfig). Usa driver adapter `@prisma/adapter-pg` com `DATABASE_URL`. O fluxo diário é `db push`; existe uma migration inicial em `prisma/migrations/` (baseline) — ao alterar o schema, mantenha-a em sincronia (regenere via `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` ou crie uma migration nova).

## Arquitetura (`src/`)

- `app/` — App Router (páginas + `app/api/` route handlers).
- `components/` — UI compartilhada (`ui/`, `Form/`, `Input/`, `Button/`, `Template/`, `public/`, `charts/`…). UI com **Chakra UI v3**.
- `lib/` — núcleo: `prisma.ts`, `auth/` (`session.ts`, `password.ts`, `current-user.ts`), `format.ts`, `pagination.ts`, `http.ts`, `id.ts`, `categories.ts`.
- `services/` — integrações externas e dados: `ipca.ts` (BCB), `brasilapi.ts` (CNPJ), `public-prices.ts` (server-only), `invoice/` (pipeline de importação), `hooks/` (TanStack Query).
- `schemas/` — Zod. `config/` — axios + `constants.ts`. `theme/` — config do Chakra. `models/` — DTOs.

## Autenticação

JWT via **`jose`** (HS256, expira em 7d), assinado com `AUTH_SECRET`, guardado em cookie httpOnly **`mi_token`**. Senhas com **bcryptjs** (10 rounds). Helpers em `src/lib/auth/`. Use `getSession()` (`current-user.ts`) em rotas protegidas (retorna `{ sub, name, email }` ou `null`).

**Papel de usuário:** coluna `users.type` (`admin` | `user`, default `user`; o admin é definido pelo `prisma/seed.ts`). O papel viaja no JWT (`session.type`) — checagem via `isAdmin(session)` (`src/lib/auth/admin.ts`, módulo puro reexportado por `current-user.ts`, sem tocar o banco; funciona no proxy). Trocar o papel exige novo login. **Recursos só-admin:** "Importar por chave" (Infosimples), "Categorizar com IA" (OpenAI) e **excluir/mesclar** o catálogo global (empresas, categorias, itens) — a UI é escondida e as rotas de API retornam 403 (criar/editar seguem liberados a qualquer usuário logado).

## Integrações externas

- **BCB SGS 433** (`ipca.ts`) — IPCA mensal, cache 24h; retorna `[]` em falha (degrada para índice só pessoal).
- **BrasilAPI** (`brasilapi.ts`) — enriquece empresas por CNPJ.
- **Infosimples** (`invoice/infosimples.ts`) — busca a nota por chave de acesso de 44 dígitos; **gated por `INFOSIMPLES_TOKEN` + admin** (sem o token ou não sendo admin, "Importar por chave" fica escondido). Dois caminhos, decididos pelo modelo nos dígitos 21–22 da chave — e o **nome do parâmetro muda por endpoint**: NF-e (55) usa `sefaz-nfe`/`nfe` e devolve `url_xml` (cai no parser de XML); NFC-e (65) usa `sefaz-nfce`/`nfce` e **não devolve XML** — só o JSON, que passa pelo adaptador `invoice/infosimples-nfce.ts` (schema Zod em `schemas/infosimples.ts`) e entra pelo `importParsedInvoice`.
  - A NFC-e **não expõe NCM nem GTIN**: esses itens entram no catálogo com `reference_code = ''`. A unificação com o item equivalente vindo de XML é **manual**, pela mesclagem na tela de Itens — o nome da NFC-e vira alias com `reference_code = ''` e as importações seguintes caem no item principal sozinhas. Por isso o matching por similaridade usa `NO_REFERENCE_SIMILARITY_THRESHOLD` (0.85, mais rígido) quando não há NCM para pré-filtrar os candidatos.
- **OpenAI** (`services/openai.ts`) — categoriza itens (produtos) numa das categorias padrão via structured output; **gated por `OPENAI_API_KEY` + admin**. Degrada para `null` em falha (não quebra o lote).
- **DANF3e** (`invoice/danfe-*.ts`) — extrai texto de PDFs de conta de energia via `unpdf` (sem OCR; PDFs escaneados retornam parcial).

## Variáveis de ambiente

Copie `.env.example` para `.env.local`:

- `DATABASE_URL` — Postgres.
- `AUTH_SECRET` — segredo aleatório de **≥32 caracteres** (assinatura JWT; a app recusa iniciar com segredo curto).
- `INFOSIMPLES_TOKEN` — opcional; habilita importação por chave (só admin).
- `OPENAI_API_KEY` — opcional; habilita categorização por IA (só admin).
- `NEXT_PUBLIC_API_URL`.

## Testes

**Vitest** (jsdom + Testing Library). Testes ao lado do código (`*.test.ts`). Alguns rodam em Node (`// @vitest-environment node`). Rode `pnpm test:run` antes de concluir mudanças com superfície de runtime.
