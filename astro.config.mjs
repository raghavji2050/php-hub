// No-op marker for the GitHub to Vercel auto-deploy smoke test.
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
export default defineConfig({
  site: 'https://php-hub-rj.vercel.app',
  trailingSlash: 'ignore',
  // Emit scripts as external files so CSP script-src 'self' (no unsafe-inline) allows them
  vite: { build: { assetsInlineLimit: 0 } },
  integrations: [sitemap({ filter: (p) => !p.includes('/404') && !p.includes('/thanks') && !p.includes('/saved') })],
});
