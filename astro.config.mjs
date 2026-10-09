// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Cloudflare Pages production domain (update if a custom domain is added)
  site: 'https://nickhuangphoto.com',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ja', 'zh', 'zh-tw'],
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