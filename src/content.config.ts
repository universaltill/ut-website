import { glob } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    excerpt: z.string(),
    author: z.string().default('Universal Till'),
    coverImage: z.string().optional(),
    draft: z.boolean().default(false),
    // Set by scripts/translate-posts.js. Drives the "translated automatically"
    // note on the post — an unlabelled machine translation is a small
    // dishonesty that costs trust the first time a reader hits an odd phrase.
    machineTranslated: z.boolean().default(false),
  }),
});

// Impressum / Privacy / Terms — long-form legal prose, same shape problem as
// blog posts (full document structure, translated per locale, honest
// English fallback when a translation doesn't exist yet), so it reuses the
// same collection + fallback machinery rather than being force-fit into
// site/i18n.js's short-string dictionary (ut-docs#1552). No `date`/`excerpt`/
// `author`/`coverImage` — these aren't articles — but `updated` drives the
// "last updated" line every legal page needs.
// No `machineTranslated` field (unlike `blog`, above): `scripts/
// translate-posts.js` only ever reads/writes `src/content/blog/`, so there
// is no mechanism yet that could produce one for this collection — adding
// the field before the script exists to set it would be a flag nobody sets
// and no page reads, exactly the kind of unwired-looking-wired gap an
// independent review of this ticket caught. When a real translation pass
// for `legal/` gets built (extending translate-posts.js, or a dedicated
// script), add the field back alongside the render-side check in
// `[slug].astro`, together, in that same change.
const legal = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/legal' }),
  schema: z.object({
    title: z.string(),
    // One-line, for <meta name="description"> — without it every legal page
    // would report its own title as its description (caught in review).
    summary: z.string(),
    updated: z.coerce.date(),
  }),
});

export const collections = { blog, legal };
