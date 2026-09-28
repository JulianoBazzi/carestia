# CLAUDE.md

Guia para agentes que trabalham neste repositório. Mantenha as convenções abaixo.

## O que é

**Carestia** — app Next.js (domínio: carestia.com.br) que permite ao usuário acompanhar a **própria inflação** importando notas fiscais eletrônicas (NF-e/NFC-e/NFS-e/NF3e) e comparando o índice pessoal com o **IPCA** oficial (BCB SGS série 433).

**Privacidade em primeiro lugar:** o banco armazena apenas o **preço unitário** de cada item (R$/un, ou R$/kWh para energia — `Decimal(14,4)`) e o **tributo aproximado por unidade** (`unit_tax_value`, R$/un — derivado de `det/imposto/vTotTrib ÷ qCom`, nulo quando o emitente não publica a tag). Nunca guarde quantidade, valor total (nem o `vTotTrib` bruto, que é total da linha), XML bruto ou dados do consumidor. A agregação pública (`public-prices.ts`) expõe **médias de preço unitário por item/região dos últimos 12 meses, sem piso mínimo de amostras ou de usuários** — a diluição vem do volume conforme a base cresce. Linhas com preço ≤ 0 são descartadas na importação e filtradas na agregação. O que ela nunca lê nem expõe é `user_id`: não há como ligar um preço publicado a uma conta.

O índice público tem **duas fontes**: `invoice_items` (notas) e `price_observations` (etiquetas de gôndola lidas no Scanner — só preço unitário + cidade/UF; a foto **não** é armazenada). `price_observations.user_id` existe só para controle de abuso/moderação e, como em `invoices`, nunca entra no `select` da agregação. Observações **não** entram na inflação pessoal (não são compras). **Geolocalização:** a coordenada do usuário é arredondada no client, serve só para resolver o município e nunca é persistida nem logada.

## Comandos

```bash
pnpm dev            # Next.js dev (webpack, não Turbopack)
pnpm build          # build de produção (webpack)
pnpm lint           # biome check .
pnpm format         # biome check --write .  (aplica correções)
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest (watch)
pnpm test:run       # vitest run (CI)
pnpm db:deploy      # aplica prisma/migrations (produção / banco novo)
pnpm db:push        # sincroniza o schema direto no banco (só desenvolvimento)
pnpm db:seed        # pg_trgm + categorias padrão + admin via ADMIN_* (idempotente)
pnpm db:studio      # Prisma Studio
pnpm data:municipios # regenera src/data/municipios.json (IBGE + centróides; precisa de rede)
```

Gerenciador de pacotes é **pnpm** (não use npm/yarn). `postinstall` roda `prisma generate`.

## Convenções

- **Import alias:** sempre importe via `~/` (mapeia para `src/`). Nunca use `./` ou `../` para caminhos internos. Ex.: `import { prisma } from '~/lib/prisma'`.
- **Formatação (Biome):** aspas **simples**, `;` sempre, indentação de 2 espaços, `lineWidth` 100. Rode `pnpm format` antes de finalizar. Não altere o estilo de aspas de um arquivo manualmente — deixe o Biome cuidar disso.
- **Chaves no `if`:** sempre use bloco com chaves, mesmo em uma linha. Nunca `if (x) return y;` — escreva `if (x) {\n  return y;\n}`. Vale para `else`/`for`/`while` também. O Biome exige (`style/useBlockStatements`).
- **IDs:** ULID (`VarChar(26)`), gerados em `~/lib/id.ts`.
- **Soft delete:** entidades usam `deleted_at`; filtre registros removidos nas queries.
- **Validação:** schemas Zod em `src/schemas/` — todo campo de texto com `max` do VarChar (senão o estouro vira 500). Nota manual: `schemas/invoice.ts` (preço > 0, UF válida, ≤ 500 itens).
- **Datas/fuso:** mês e dia de competência sempre em `America/Sao_Paulo` via `monthKey`/`toDateInputValue` (`lib/format.ts`) — nunca `toISOString().slice(...)` (a compra das 22h do dia 30 cairia no mês seguinte). Data sem hora (`yyyy-mm-dd`, formulário) vira meio-dia BRT.
- **Service worker (next-pwa):** `runtimeCaching` próprio em `next.config.mjs` — só assets estáticos e `/api/public/*` vão para o cache; o resto do domínio é `NetworkOnly` (os defaults guardavam `/api/*` e páginas privadas por 24h no aparelho).
- **Prisma:** client gerado em `src/generated/prisma` (fora do lint/tsconfig). Usa driver adapter `@prisma/adapter-pg` com `DATABASE_URL`. Existe **uma única migration** (`prisma/migrations/20260927000000_init`, gerada do zero para o reset do banco de 2026-09). Produção sobe com `db:deploy`; `db push` é só para desenvolvimento. Ao alterar o schema depois que houver dados em produção, crie uma migration NOVA (`pnpm db:migrate`) — não reescreva a init. O `prisma.config.ts` carrega o dotenv com `quiet: true`; sem isso o log `◇ injected env` vaza no stdout do `migrate diff` e quebra o SQL.

## Arquitetura (`src/`)

- `app/` — App Router (páginas + `app/api/` route handlers).
- `components/` — UI compartilhada (`ui/`, `Form/`, `Input/`, `Button/`, `Template/`, `public/`, `charts/`…). UI com **Chakra UI v3**.
- `lib/` — núcleo: `prisma.ts`, `auth/` (`session.ts`, `password.ts`, `current-user.ts`), `format.ts`, `pagination.ts`, `http.ts`, `id.ts`, `categories.ts`. Helpers puros usados no client e no server: `ean.ts` (GTIN: checksum + variantes com zeros), `access-key.ts` (chave de 44 dígitos: DV mod-11 + extração do QR), `ufs.ts`, `image.ts` (client). `geo/municipios.ts` (server-only) resolve município por coordenada/nome.
- `data/` — `municipios.json`: 5.570 municípios com código IBGE e centróide (dataset MIT kelvins/municipios-brasileiros, gerado por `scripts/build-municipios.ts`; fora do Biome).
- `services/` — integrações externas e dados: `ipca.ts` (BCB), `brasilapi.ts` (CNPJ), `public-prices.ts` (server-only; índice + `getPublicPriceByEan`), `price-observations.ts` (server-only), `invoice/` (pipeline de importação), `hooks/` (TanStack Query).
- `schemas/` — Zod. `config/` — axios + `constants.ts`. `theme/` — config do Chakra. `models/` — DTOs.

## Autenticação

JWT via **`jose`** (HS256, expira em 7d), assinado com `AUTH_SECRET`, guardado em cookie httpOnly **`mi_token`**. Senhas com **bcryptjs** (10 rounds; 8–72 caracteres). E-mail sempre normalizado (trim + minúsculas, `zemail` em `schemas/auth.ts`). Helpers em `src/lib/auth/`. Use `getSession()` (`current-user.ts`) em rotas protegidas (retorna `{ sub, name, email }` ou `null`). O token **não é revogável** (não consulta o banco) — trocar senha/excluir conta não derruba sessões abertas (backlog).

- **Proxy (`src/proxy.ts`):** página sem sessão → 307 para `/login?next=<path>`; **API sem sessão → 401 JSON** (um redirect faria o axios receber HTML 200). `safeNextPath` (`lib/auth/next-path.ts`) só aceita caminho interno — rejeita caracteres de controle (`/%09/evil.com`).
- **Client:** login/cadastro/logout passam por `lib/auth/client-session.ts` (`enterApp`/`logout`): limpa o cache do TanStack Query e os caches de runtime do service worker e navega com recarga completa — nada da sessão anterior fica na aba.
- **Cadastro:** fechado por padrão (beta); `REGISTRATION_OPEN=true` abre. `isRegistrationOpen()` (`lib/registration.ts`, server-only) esconde os links de "Criar conta"; por isso `/login`, `/register`, `/privacy` e `/terms` são `force-dynamic`.
- **Excluir conta** anonimiza a linha (nome vazio, e-mail `deleted-<id>@deleted.invalid`, hash aleatório) além do soft delete — o e-mail fica livre. Notas/observações ficam (só preço unitário).

**Papel de usuário:** coluna `users.type` (`admin` | `user`, default `user`; o admin é definido pelo `prisma/seed.ts`). O papel viaja no JWT (`session.type`) — checagem via `isAdmin(session)` (`src/lib/auth/admin.ts`, módulo puro reexportado por `current-user.ts`, sem tocar o banco; funciona no proxy). Trocar o papel exige novo login. **Recursos só-admin:** a tela em lote "Importar por chave" (`/invoices/import/key`), "Categorizar com IA" (OpenAI), **excluir/mesclar** o catálogo global (empresas, categorias, itens) e **definir o EAN de um item** — a UI é escondida/desabilitada e as rotas de API retornam 403 (no EAN, o campo é ignorado para não-admin: o lookup público e o atalho da importação confiam nele). Criar/editar o resto segue liberado a qualquer usuário logado. **Exceção (Scanner):** as rotas `POST /api/invoices/import-key` e `POST /api/labels/read` atendem **qualquer usuário logado**, com cota — ver a seção Scanner.

## Integrações externas

- **BCB SGS 433** (`ipca.ts`) — IPCA mensal, cache 24h; retorna `[]` em falha (degrada para índice só pessoal).
- **BrasilAPI** (`brasilapi.ts`) — enriquece empresas por CNPJ.
- **Infosimples** (`invoice/infosimples.ts`) — busca a nota por chave de acesso de 44 dígitos (consulta **paga**); **gated por `INFOSIMPLES_TOKEN`**. A tela em lote é só-admin; o QR code da NFC-e no Scanner usa a mesma rota para qualquer usuário logado, com cota. Dois caminhos, decididos pelo modelo nos dígitos 21–22 da chave — e o **nome do parâmetro muda por endpoint**: NF-e (55) usa `sefaz-nfe`/`nfe` e devolve `url_xml` (cai no parser de XML); NFC-e (65) usa `sefaz-nfce`/`nfce` e **não devolve XML** — só o JSON, que passa pelo adaptador `invoice/infosimples-nfce.ts` (schema Zod em `schemas/infosimples.ts`) e entra pelo `importParsedInvoice`.
  - A NFC-e **não expõe NCM nem GTIN**: esses itens entram no catálogo com `reference_code = ''`. A unificação com o item equivalente vindo de XML é **manual**, pela mesclagem na tela de Itens — o nome da NFC-e vira alias com `reference_code = ''` e as importações seguintes caem no item principal sozinhas. Por isso o matching por similaridade usa `NO_REFERENCE_SIMILARITY_THRESHOLD` (0.85, mais rígido) quando não há NCM para pré-filtrar os candidatos.
- **OpenAI** (`services/openai.ts`) — (1) `categorizeItem`: categoriza itens numa das categorias padrão via structured output (**só-admin**); (2) `readPriceLabel`: lê a foto de uma etiqueta de gôndola (EAN, preço, nome, unidade) pela Responses API com `input_image` + `json_schema` (**qualquer usuário logado, com cota**). Ambos **gated por `OPENAI_API_KEY`** e degradam para `null` em falha. O EAN devolvido pelo modelo só é aceito com dígito verificador válido (`sanitizeLabelReading`).
- **DANF3e** (`invoice/danfe-*.ts`) — extrai texto de PDFs de conta de energia via `unpdf` (sem OCR; PDFs escaneados retornam parcial).

## Scanner (`/scanner`)

Tela mobile-first e **pública** (está em `PUBLIC_PATHS` do `proxy.ts`), com três abas em `src/app/scanner/components/` (`lazyMount` + `unmountOnExit`: só uma câmera ligada por vez). A câmera usa `@yudiel/react-qr-scanner` (BarcodeDetector nativo + polyfill zxing-wasm, carregado via `next/dynamic` com `ssr: false` em `camera-scanner.tsx`). O header `Permissions-Policy` em `next.config.mjs` libera `camera=(self)` e `geolocation=(self)` — sem isso nada funciona. Câmera e GPS exigem **HTTPS** (no celular em dev: túnel tipo ngrok).

1. **Preço (código de barras)** — sem login. `GET /api/public/prices/ean/[ean]?state&city&ibge_code` → `getPublicPriceByEan`: recortes **cidade → UF → Brasil** dos últimos 12 meses, unindo notas + observações. EAN desconhecido responde **200 com `item: null`** (não é erro). A cidade casa por `ibge_code` OU por nome normalizado + UF (o IBGE só vem do XML da NF-e; a importação agora faz backfill pelo nome via `findMunicipioByName`). A busca no catálogo usa `eanCandidates` (UPC-A de 12 dígitos × EAN-13 com zero à esquerda são o mesmo produto).
2. **Etiqueta (foto)** — login. O client reduz a foto (`lib/image.ts`, ≤1280 px JPEG), tenta ler o código de barras **no aparelho** (`barcode-detector/ponyfill` — vence o EAN do modelo) e chama `POST /api/labels/read`. O usuário confere o formulário e `POST /api/price-observations` grava a observação (`createPriceObservation`: resolve o item pelo EAN **como está gravado** no catálogo antes de chamar `findOrCreateItem`, que compara por igualdade; item novo entra com `reference_code = ''`; reenvio do mesmo item+preço em 10 min é idempotente). `mergeItems` reaponta as observações junto com os `invoice_items`.
3. **Cupom (QR da NFC-e)** — login. `extractAccessKey` (`lib/access-key.ts`) tira a chave do QR v2 (`?p=<44>|…`), do legado (`chNFe=`) ou do Code-128, valida o DV e o modelo (55/65) e chama `POST /api/invoices/import-key`.

**Geolocalização sem geocoder externo:** `GET /api/public/geo/reverse?lat&lng` devolve o município de centróide mais próximo (`lib/geo/municipios.ts`). O hook `useUserLocation` arredonda a coordenada a 2 casas, guarda só cidade/UF/IBGE no `localStorage` e sempre permite informar a cidade à mão (o centróide pode errar em divisas).

**Cotas das APIs pagas** (admin isento; `enforceRateLimit(..., { by: 'user', cost })` em `lib/rate-limit.ts`): import-key = 20 consultas/dia por usuário, máx. 5 chaves por requisição, teto global 500/dia — só chaves ainda não importadas consomem cota; labels/read = 30/dia por usuário, teto global 500/dia; price-observations = 50/dia. O teto global é checado **antes** da cota do usuário (e devolvido com `refundRateLimit` se a do usuário recusar) — ninguém perde cota numa recusa. Os contadores são **em memória** (janela fixa a partir do 1º hit, zeram no deploy, não são globais entre instâncias) — é salvaguarda de custo, não contabilidade. O IP do rate limit é o valor **mais à direita** do `X-Forwarded-For` (`TRUST_PROXY_HOPS`, padrão 1) — o da esquerda é forjável. Login tem limite por IP **e** por e-mail.

**EAN no catálogo:** só entra GTIN que passa em `isCatalogGtin` (`lib/ean.ts`): dígito verificador + fora das faixas de circulação restrita (prefixo `2`/`02`/`04` de balança e uso interno, `98`/`99` cupons, RCN-8) e não zerado — esses códigos se repetem entre lojas e o atalho por EAN da importação fundiria produtos diferentes. O atalho busca pelas variantes `eanCandidates` (UPC-A × EAN-13).

## Variáveis de ambiente

Copie `.env.example` para `.env.local`:

- `DATABASE_URL` — Postgres.
- `REDIS_URL` — cache (default `redis://127.0.0.1:6379`). **Opcional**: sem Redis no ar tudo funciona, só mais lento (helpers em `~/lib/redis` engolem a falha e caem na fonte real). Instância compartilhada entre apps: as chaves vão sob o prefixo `carestia:` e **toda** chave precisa de TTL (a instância é `noeviction`).
- `AUTH_SECRET` — segredo aleatório de **≥32 caracteres** (assinatura JWT; a app recusa iniciar com segredo curto).
- `INFOSIMPLES_TOKEN` — opcional; habilita importação por chave (tela em lote só-admin + QR da NFC-e no Scanner para qualquer logado, com cota).
- `OPENAI_API_KEY` — opcional; habilita categorização por IA (só admin) e leitura de etiqueta no Scanner (qualquer logado, com cota).
- `REGISTRATION_OPEN` — `true` abre o cadastro público (padrão: fechado).
- `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` — só o `pnpm db:seed` lê; cria/atualiza o admin (senha ≥ 12). O `seed.ts` é versionado e não contém credencial.
- `TRUST_PROXY_HOPS` — opcional (padrão 1); proxies na frente do app que anexam ao `X-Forwarded-For`.

## Testes

**Vitest** (jsdom + Testing Library). Testes ao lado do código (`*.test.ts`). Alguns rodam em Node (`// @vitest-environment node`). Rode `pnpm test:run` antes de concluir mudanças com superfície de runtime.
