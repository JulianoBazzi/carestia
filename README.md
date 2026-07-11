# Minha Inflação

Acompanhe a inflação do seu próprio bolso. **Minha Inflação** é um app que calcula o seu índice de preços pessoal a partir das suas notas fiscais eletrônicas e o compara com o **IPCA** oficial — de forma anônima e privada.

Em vez de depender apenas de médias nacionais, você descobre quanto os preços que **você realmente paga** (do supermercado à conta de luz) subiram ao longo do tempo.

## Como funciona

1. Você importa suas notas fiscais — por upload de XML/PDF ou pela **chave de acesso** de 44 dígitos.
2. O app extrai e normaliza produtos, serviços e energia, guardando **apenas o preço unitário** de cada item.
3. Seu índice pessoal é calculado e comparado com o IPCA (BCB SGS série 433).
4. Uma busca pública mostra preços médios regionais, agregados e anonimizados a partir de notas reais.

### Privacidade

O projeto é *privacy-first*: o banco armazena somente o **preço unitário** por item (R$/un, ou R$/kWh para energia). Quantidade, valor total, XML bruto e dados do consumidor **não são persistidos**. Os preços públicos só aparecem quando há pelo menos 3 amostras para a região.

## Funcionalidades

- Autenticação (cadastro, login, conta e troca de senha)
- Importação de notas via XML/PDF e por chave de acesso (NF-e, NFC-e, NFS-e e conta de energia NF3e)
- Categorias, empresas (por CNPJ) e itens normalizados, com mesclagem de itens duplicados
- Dashboard com o índice pessoal x IPCA
- Evolução de preço por item
- Busca pública de preços regionais

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
#   edite .env.local com sua DATABASE_URL e um AUTH_SECRET aleatório

# 3. Banco de dados
pnpm db:push     # cria o schema
pnpm db:seed     # popula as categorias padrão

# 4. Desenvolvimento
pnpm dev         # http://localhost:3000
```

### Variáveis de ambiente

| Variável | Descrição |
| --- | --- |
| `DATABASE_URL` | String de conexão do PostgreSQL |
| `AUTH_SECRET` | Segredo aleatório de **pelo menos 32 caracteres** para assinar o JWT |
| `INFOSIMPLES_TOKEN` | Opcional. Habilita a importação de notas por chave de acesso (somente admin) |
| `OPENAI_API_KEY` | Opcional. Habilita a categorização de itens por IA (somente admin) |
| `NEXT_PUBLIC_APP_NAME` | Nome exibido do app |
| `NEXT_PUBLIC_API_URL` | URL base da API (ex.: `http://localhost:3000/api`) |

## Scripts

| Comando | Descrição |
| --- | --- |
| `pnpm dev` | Ambiente de desenvolvimento |
| `pnpm build` / `pnpm start` | Build e execução de produção |
| `pnpm lint` / `pnpm format` | Checa / corrige com Biome |
| `pnpm test` / `pnpm test:run` | Testes (watch / CI) |
| `pnpm db:push` | Aplica o schema no banco |
| `pnpm db:migrate` | Cria e aplica migrations |
| `pnpm db:seed` | Popula categorias padrão |
| `pnpm db:studio` | Abre o Prisma Studio |

## Convenções

- Imports internos usam o alias `~/` (mapeado para `src/`).
- Formatação padronizada pelo Biome (aspas simples, 2 espaços). Rode `pnpm format` antes de commitar.
- Consulte [CLAUDE.md](CLAUDE.md) para detalhes de arquitetura e convenções.

## Licença

ISC — Juliano Bazzi.
