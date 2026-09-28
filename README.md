# Carestia

Acompanhe a inflação do seu próprio bolso. A **Carestia** é um app que calcula o seu índice de preços pessoal a partir das suas notas fiscais eletrônicas e o compara com o **IPCA** oficial — de forma anônima e privada.

Em vez de depender apenas de médias nacionais, você descobre quanto os preços que **você realmente paga** (do supermercado à conta de luz) subiram ao longo do tempo.

## Como funciona

1. Você importa suas notas fiscais — por upload de XML/PDF ou pela **chave de acesso** de 44 dígitos.
2. O app extrai e normaliza produtos, serviços e energia, guardando **apenas o preço unitário** de cada item.
3. Seu índice pessoal é calculado e comparado com o IPCA (BCB SGS série 433).
4. Uma busca pública mostra preços médios regionais, agregados e anonimizados a partir de notas e etiquetas de preço reais.
5. No celular, o **Scanner** consulta o preço de um produto pelo código de barras (na sua cidade, UF ou Brasil), registra o preço de uma etiqueta de gôndola por foto e importa o cupom pelo QR code da NFC-e.

### Privacidade

O projeto é *privacy-first*: o banco armazena somente o **preço unitário** por item (R$/un, ou R$/kWh para energia). Quantidade, valor total, XML bruto e dados do consumidor **não são persistidos**. A agregação pública expõe médias por item/região sem ler o `user_id` — não há como ligar um preço publicado a uma conta. No Scanner, a localização vira só cidade/UF (a coordenada nunca é gravada) e a foto da etiqueta não é armazenada.

## Funcionalidades

- Autenticação (cadastro, login, conta e troca de senha)
- Importação de notas via XML/PDF e por chave de acesso (NF-e, NFC-e, NFS-e e conta de energia NF3e)
- Categorias, empresas (por CNPJ) e itens normalizados, com mesclagem de itens duplicados
- Dashboard com o índice pessoal x IPCA
- Evolução de preço por item
- Busca pública de preços regionais
- Scanner mobile: preço por código de barras com geolocalização, leitura de etiqueta por foto (IA) e importação da NFC-e pelo QR code

## Stack

- **Next.js 16** (App Router, React 19, webpack)
- **Chakra UI v3** + Recharts
- **Prisma 7** com **PostgreSQL** (driver adapter `@prisma/adapter-pg`)
- Autenticação **JWT** com `jose` (cookie httpOnly) + `bcryptjs`
- **TanStack** Query / Form / Table, **Zod** v4
- **Biome** (lint + format) e **Vitest** (testes)
- Gerenciador de pacotes: **pnpm**

## Como rodar

Pré-requisitos: Node, **pnpm** e um banco **PostgreSQL**.

```bash
# 1. Dependências
pnpm install

# 2. Variáveis de ambiente
cp .env.example .env.local
#   edite .env.local com DATABASE_URL, AUTH_SECRET e ADMIN_* (admin do seed)

# 3. Banco de dados (banco vazio)
pnpm db:deploy   # aplica a migration (prisma/migrations)
pnpm db:seed     # extensão pg_trgm, categorias padrão e o admin (ADMIN_*)

# 4. Desenvolvimento
pnpm dev         # http://localhost:3000
```

### Variáveis de ambiente

| Variável | Descrição |
| --- | --- |
| `DATABASE_URL` | String de conexão do PostgreSQL |
| `AUTH_SECRET` | Segredo aleatório de **pelo menos 32 caracteres** para assinar o JWT |
| `INFOSIMPLES_TOKEN` | Opcional. Habilita a importação por chave de acesso: QR code da NFC-e no Scanner (qualquer usuário, com cota diária) e a tela em lote (somente admin) |
| `OPENAI_API_KEY` | Opcional. Habilita a leitura de etiqueta no Scanner (qualquer usuário, com cota diária) e a categorização de itens por IA (somente admin) |
| `REDIS_URL` | Opcional. Cache (padrão `redis://127.0.0.1:6379`); sem Redis tudo funciona, só mais lento |
| `REGISTRATION_OPEN` | `true` abre o cadastro público. Ausente = beta fechado (links de "Criar conta" somem e a rota responde 403) |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Usados só pelo `pnpm db:seed` para criar/atualizar o admin (senha com ≥ 12 caracteres) |
| `TRUST_PROXY_HOPS` | Opcional (padrão `1`). Quantos proxies anexam ao `X-Forwarded-For` na frente do app — use `2` atrás de Cloudflare + nginx. Define o IP usado no rate limit |

## Scripts

| Comando | Descrição |
| --- | --- |
| `pnpm dev` | Ambiente de desenvolvimento |
| `pnpm build` / `pnpm start` | Build e execução de produção |
| `pnpm lint` / `pnpm format` | Checa / corrige com Biome |
| `pnpm typecheck` | Checagem de tipos (`tsc --noEmit`) |
| `pnpm test` / `pnpm test:run` | Testes (watch / CI) |
| `pnpm db:deploy` | Aplica as migrations (produção / banco novo) |
| `pnpm db:push` | Sincroniza o schema direto no banco (só desenvolvimento) |
| `pnpm db:migrate` | Cria e aplica migrations |
| `pnpm db:seed` | Categorias padrão + admin (via `ADMIN_*`) |
| `pnpm db:studio` | Abre o Prisma Studio |

## Convenções

- Imports internos usam o alias `~/` (mapeado para `src/`).
- Formatação padronizada pelo Biome (aspas simples, 2 espaços). Rode `pnpm format` antes de commitar.
- Consulte [CLAUDE.md](CLAUDE.md) para detalhes de arquitetura e convenções.

## Licença

ISC — Juliano Bazzi.
