import withPWAInit from 'next-pwa';

const DAY = 24 * 60 * 60;

// Cache do service worker. Os defaults do next-pwa guardam por 24h todo
// `GET /api/*` e todas as páginas — ou seja, notas e índice pessoal ficariam no
// disco do aparelho mesmo após o logout (e apareceriam para a próxima pessoa em
// um celular compartilhado, offline ou com rede lenta). Aqui só assets estáticos
// e a API pública (sem dado pessoal) são cacheados; o resto do mesmo domínio vai
// sempre à rede.
const runtimeCaching = [
  {
    urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
    handler: 'CacheFirst',
    options: { cacheName: 'google-fonts', expiration: { maxEntries: 8, maxAgeSeconds: 365 * DAY } },
  },
  {
    urlPattern: /\/_next\/static\/.*/i,
    handler: 'CacheFirst',
    options: { cacheName: 'next-static', expiration: { maxEntries: 256, maxAgeSeconds: 30 * DAY } },
  },
  {
    urlPattern: /\.(?:png|jpe?g|svg|gif|webp|ico|woff2?|wasm)$/i,
    handler: 'StaleWhileRevalidate',
    options: { cacheName: 'static-assets', expiration: { maxEntries: 64, maxAgeSeconds: 7 * DAY } },
  },
  {
    urlPattern: ({ url }) => self.origin === url.origin && url.pathname.startsWith('/api/public/'),
    handler: 'NetworkFirst',
    options: {
      cacheName: 'public-api',
      networkTimeoutSeconds: 10,
      expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 },
    },
  },
  {
    urlPattern: ({ url }) => self.origin === url.origin,
    handler: 'NetworkOnly',
    options: { cacheName: 'network-only' },
  },
];

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  // A start URL (`/`) muda conforme a sessão — não pode ir para o cache.
  cacheStartUrl: false,
  dynamicStartUrl: false,
  publicExcludes: ['!noprecache/**/*', '!icons/README.md'],
  runtimeCaching,
});

// Cabeçalhos de segurança aplicados a todas as respostas. CSP completo (script/
// style) fica de fora por ora porque o Chakra/emotion injetam estilo inline e
// exigiriam nonce/ajuste — só `frame-ancestors` (anti-clickjacking, não afeta
// carregamento de recursos) é aplicado via CSP.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), geolocation=(self), microphone=(), browsing-topics=()',
  },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // Pin the workspace root to this project. Without this, Next.js 16 detects a
  // stray lockfile in a parent dir and infers the wrong root, breaking `~/` alias
  // resolution. See https://nextjs.org/docs/app/api-reference/config/next-config-js/output#caveats
  outputFileTracingRoot: import.meta.dirname,
  experimental: {
    // Uploads de .zip com muitas notas passam do padrão de 10 MB do Next 16,
    // o que trunca o body e faz req.formData() falhar em /api/invoices/import.
    proxyClientMaxBodySize: '50mb',
  },
  webpack: (config) => {
    // Silencia o aviso não-fatal e repetitivo do PackFileCache
    // ("Serializing big strings ... impacts deserialization performance"),
    // inerente ao tamanho dos bundles (Chakra UI v3, cliente Prisma, ícones).
    config.infrastructureLogging = { level: 'error' };
    return config;
  },
};

export default withPWA(nextConfig);
