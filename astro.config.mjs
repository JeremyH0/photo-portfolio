// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Cloudflare Pages production domain (update if a custom domain is added)
  site: 'https://photo-portfolio-d1s.pages.dev',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ja', 'zh'],
    routing: {
      prefixDefaultLocale: true,
    },
  },
  redirects: {
    '/': '/en/',
  },
  vite: {
    plugins: [tailwindcss()]
  }
});