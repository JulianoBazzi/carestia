import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
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
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
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
