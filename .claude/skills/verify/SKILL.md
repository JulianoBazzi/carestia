# Verify — Minha Inflação

Receita para verificar mudanças de runtime dirigindo o app de verdade (Next.js + Chakra).

## Subir o app

- Dev server do usuário costuma estar em `http://localhost:3000` (`pnpm dev`). Cheque antes: `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/`.
- Se precisar de servidor próprio, use outra porta **e** sobrescreva a API pública (o client axios usa `NEXT_PUBLIC_API_URL` do `.env.local`, apontando para :3000 — sem override, o login numa porta alternativa posta num servidor morto e trava):
  `PORT=3001 NEXT_PUBLIC_API_URL="http://localhost:3001/api" pnpm dev`
- Não rode dois dev servers ao mesmo tempo (compartilham `.next/`).

## Dirigir com navegador

- Playwright não está no projeto. Instale `playwright-core` num diretório temporário (scratchpad) e lance o Chrome do sistema: `chromium.launch({ channel: 'chrome', headless: true })`.
- Login: `/login`, campos `input[name="email"]` e `input[name="password"]`, botão `button[type="submit"]`; sucesso navega para `/dashboard`.
- Credenciais de dev: admin do `prisma/seed.ts` (constantes `ADMIN_EMAIL`/`ADMIN_PASSWORD`). Se der 401, o banco local pode ter senha diferente do seed — rode `pnpm db:seed` ou pergunte ao usuário.
- Menu do usuário: trigger `[aria-label="Menu da conta"]`; itens são `[role="menuitem"][data-value="..."]` (ex.: `theme`, `account`, `logout`). Menus do Chakra/Zag animam — espere ~350ms após abrir e use `click({ force: true })` para evitar "element is not stable".
- Tema: next-themes com classe no `<html>` (`light`/`dark`) e chave `theme` no localStorage; emule SO com `colorScheme: 'dark'|'light'` no contexto.

## Gotchas

- Rotas compilam sob demanda no dev — aqueça com `curl` antes de medir/esperar navegação, ou timeouts estouram.
- `/favicon.ico` retorna 404 (pré-existente; ícones vêm de `icon.png` via App Router).
- Warnings de preload de fonte no console do dev são ruído conhecido.
