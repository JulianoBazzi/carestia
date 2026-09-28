# Ícones do PWA

`icon.svg` (fundo teal, seta de alta) é o ícone provisório usado pelo manifest e
como favicon (`src/app/icon.svg`). O conteúdo fica dentro da zona segura de
80%, então serve também como `maskable`.

Ainda faltam os PNGs (o iOS e alguns launchers Android ignoram SVG). Ao
gerá-los, adicione as entradas de volta em `public/manifest.json`:

- `icon-192.png` — 192×192
- `icon-512.png` — 512×512
- `src/app/apple-icon.png` — 180×180 (ícone da tela inicial no iOS)

Gere a partir do logo final (ex.: `pnpm dlx pwa-asset-generator logo.svg ./public/icons`).
