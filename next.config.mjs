import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
