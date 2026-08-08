import type { APIRoute } from 'astro';
import { LANGS } from '../layouts/BaseLayout.astro';
import { getAllLocalizedPosts } from '../lib/blogPosts';
// Marketing pages (site/*.html) are plain HTML served via publicDir — they
// never pass through Astro's own routing, so nothing here would otherwise
// know they exist. site/staticwebapp.config.json is the actual source of
// truth for which locale-prefixed paths serve them (it's what Azure Static
// Web Apps itself reads, and what scripts/serve-site.js replays for tests) —
// import it directly rather than hand-listing the paths a second time, so
// this sitemap can't quietly drift from the real route table the way the
// header markup once did (tests/site-consistency.spec.js). A static import
// (not runtime fs) because this endpoint is prerendered and bundled into
// dist/ — a path built from import.meta.url would resolve against the
// bundled chunk's location, not the source tree.
import swaConfig from '../../site/staticwebapp.config.json';

// Raw source of every site/*.html file, so a page's own <meta
// name="robots" content="noindex"> (site/language.html — it's a picker,
// not indexable content) excludes it from here too. A sitemap listing a
// noindex page is itself a defect independent of what fixed it locally;
// checking the actual markup, rather than a second hand-kept exclusion
// list, means a future noindex page is picked up automatically.
const siteHtml = import.meta.glob('../../site/*.html', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

function isNoindex(rewrite: string): boolean {
  const key = Object.keys(siteHtml).find((k) => k.endsWith(rewrite));
  const html = key ? siteHtml[key] : '';
  return /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html);
}

function marketingPaths(): string[] {
  return swaConfig.routes
    // '*'-suffixed rewrite targets aren't real pages (e.g. a future
    // catch-all) — .html-suffixed, non-wildcard rewrites only.
    .filter((r: any) => typeof r.rewrite === 'string' && r.rewrite.endsWith('.html') && !r.route.includes('*'))
    .filter((r: any) => !isNoindex(r.rewrite))
    .map((r: any) => r.route as string);
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
  for (const lang of LANGS) {
    entries.push(urlEntry(`${base}/${lang}/blog/`));
    entries.push(urlEntry(`${base}/${lang}/plugins/`));
    for (const { slug, post } of byLocale[lang] ?? []) {
      entries.push(urlEntry(`${base}/${lang}/blog/${slug}/`, post.data.date.toISOString()));
    }
  }

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.join('\n') +
    '\n</urlset>\n';

  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
