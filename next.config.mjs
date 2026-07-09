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
};

export default withPWA(nextConfig);
