// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
    site: 'https://sollyfouad.github.io',
    base: '/elabd-concept',
    i18n: {
          defaultLocale: 'ar',
          locales: ['ar', 'en'],
          routing: { prefixDefaultLocale: false },
    },
    vite: {
          plugins: [tailwindcss()]
    }
});
