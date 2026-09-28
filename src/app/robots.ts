import type { MetadataRoute } from 'next';

/** Só as páginas públicas são indexáveis; API e área logada ficam de fora. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/scanner', '/privacy', '/terms'],
        disallow: [
          '/inflation',
          '/api/',
          '/dashboard',
          '/invoices',
          '/items',
          '/categories',
          '/companies',
          '/account',
        ],
      },
    ],
    host: 'https://carestia.com.br',
  };
}
