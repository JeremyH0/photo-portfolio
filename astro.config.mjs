// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // TODO: replace with the real domain once decided
  site: 'https://photo-portfolio.pages.dev',
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