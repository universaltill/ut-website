import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://www.universaltill.com',
  // The existing plain-HTML marketing site (site/*.html, i18n.js, images)
  // is deliberately NOT being rewritten into Astro components in this pass
  // — it's proven, multilingual (en/tr/zh/fa), and re-transcribing ~500
  // translated strings by hand risks silently introducing translation bugs
  // nobody would catch before it's live. `publicDir: 'site'` makes Astro
  // copy it into the build output byte-for-byte unchanged, same as today.
  // Astro only builds genuinely NEW surface: the blog (content collections)
  // and the Decap CMS admin. Migrating the marketing pages to Astro's own
  // i18n routing is a real, separate decision — see docs/astro-migration.md.
  publicDir: 'site',
  integrations: [mdx()],
});
