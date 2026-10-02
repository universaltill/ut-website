import type { APIRoute } from 'astro';
import { LANGS } from '../layouts/BaseLayout.astro';
import { getAllLocalizedPosts } from '../lib/blogPosts';
import { getAllLocalizedLegalPages } from '../lib/legalPages';
import { isNoindex, marketingRoutes, templateFor } from '../lib/marketingPages';
// Marketing pages (site/*.html) are plain HTML served via publicDir and
// prerendered per locale by src/pages/[lang]/[file].ts — they never pass
// through Astro's page routing, so the route table is what says they exist.
// Which locale URLs serve a marketing page, and which of those are noindex
// (site/language.html — a picker, not content), is decided in ONE place:
// src/lib/marketingPages.ts, which reads site/staticwebapp.config.json's
// route table and each template's own <meta name="robots">. The prerender
// and this sitemap therefore can't disagree about what is indexable
// (ut-docs#3480 review, MINOR-2).
function marketingPaths(): string[] {
  return marketingRoutes()
    .filter((r) => !isNoindex(templateFor(r.file)))
    .map((r) => `/${r.locale}${r.suffix}`);
}

function urlEntry(loc: string, lastmod?: string) {
  return `  <url>\n    <loc>${loc}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </url>`;
}

export const GET: APIRoute = async ({ site }) => {
  const base = site!.href.replace(/\/$/, '');
  const entries: string[] = [];

  for (const path of marketingPaths()) {
    entries.push(urlEntry(`${base}${path}`));
  }

  // Trailing slash on every Astro-rendered entry: these are directory-style
  // builds (dist/en-gb/blog/index.html), and BaseLayout's own <link
  // rel="canonical"> already resolves to the trailing-slash form via
  // Astro.url.pathname — a sitemap URL that disagrees with the page's own
  // canonical just tells a crawler which one to distrust.
  const byLocale = await getAllLocalizedPosts();
  const legalByLocale = await getAllLocalizedLegalPages();
  for (const lang of LANGS) {
    entries.push(urlEntry(`${base}/${lang}/blog/`));
    entries.push(urlEntry(`${base}/${lang}/plugins/`));
    for (const { slug, post } of byLocale[lang] ?? []) {
      entries.push(urlEntry(`${base}/${lang}/blog/${slug}/`, post.data.date.toISOString()));
    }
    for (const { slug, page } of legalByLocale[lang] ?? []) {
      entries.push(urlEntry(`${base}/${lang}/legal/${slug}/`, page.data.updated.toISOString()));
    }
  }

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.join('\n') +
    '\n</urlset>\n';

  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
