// Build-time per-locale prerender of the plain-HTML marketing pages
// (site/*.html) — ut-docs#3480.
//
// Those pages are translated client-side by site/i18n.js, so before this
// every locale URL (/de-de, /tr-tr/download, …) served byte-identical English
// HTML with `lang="en"` and a canonical pointing at a redirecting, unprefixed
// URL. A crawler that doesn't run JS saw five English duplicates; one that
// does saw a raw canonical contradicting the rendered one. This applies the
// SAME dict lookups i18n.js's apply() does, once per locale at build time, so
// the raw HTML of /de-de is already German with a self-referencing canonical
// and the full hreflang set. i18n.js still runs on top and changes nothing
// for the page's own locale — language switching keeps working exactly as
// before.
//
// site/*.html itself stays the untouched template (publicDir copies it
// byte-for-byte; CI checks that), and site/staticwebapp.config.json's routes
// rewrite each locale URL to the prerendered /<locale>/<page>.html this
// emits. The route table stays the one source of truth for which locale
// URLs exist — sitemap.xml.ts reads it too.
import { parse, parseFragment, serialize } from 'parse5';
import swaConfig from '../../site/staticwebapp.config.json';

export const ORIGIN = 'https://www.universaltill.com';

const templates = import.meta.glob('../../site/*.html', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;
const i18nSrc = import.meta.glob('../../site/i18n.js', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

// The dict is a plain object literal of developer-authored strings — the
// same extraction scripts/check-i18n-keys.js does, so the two can't disagree
// about what the dict contains.
function loadDict(): Record<string, Record<string, string>> {
  const src = Object.values(i18nSrc)[0];
  const m = src?.match(/const I18N = (\{[\s\S]*?\});\s*\n\s*\(function/);
  if (!m) throw new Error('marketingPages: could not locate the I18N object literal in site/i18n.js');
  return (0, eval)('(' + m[1] + ')');
}
export const I18N = loadDict();
export const LOCALES = Object.keys(I18N);

const bcp47 = (code: string) => {
  const parts = code.split('-');
  return parts.length === 2 ? `${parts[0]}-${parts[1].toUpperCase()}` : code;
};

export interface MarketingRoute {
  /** e.g. "de-de" */
  locale: string;
  /** Path after the locale, "" for the homepage, "/download" otherwise. */
  suffix: string;
  /** Template file name in site/, e.g. "download.html". */
  file: string;
}

/** Every locale-prefixed route that rewrites to a prerendered page. */
export function marketingRoutes(): MarketingRoute[] {
  const out: MarketingRoute[] = [];
  for (const r of (swaConfig as any).routes) {
    if (typeof r.rewrite !== 'string' || !r.rewrite.endsWith('.html') || r.route.includes('*')) continue;
    const m = r.route.match(/^\/([a-z]{2}-[a-z]{2})(\/[a-z-]+)?$/);
    if (!m || !LOCALES.includes(m[1])) continue;
    const file = r.rewrite.split('/').pop()!;
    if (r.rewrite !== `/${m[1]}/${file}`) {
      throw new Error(`marketingPages: ${r.route} must rewrite to /${m[1]}/${file}, not ${r.rewrite}`);
    }
    out.push({ locale: m[1], suffix: m[2] ?? '', file });
  }
  return out;
}

export function templateFor(file: string): string {
  const key = Object.keys(templates).find((k) => k.endsWith('/' + file));
  if (!key) throw new Error(`marketingPages: no site/${file} template`);
  return templates[key];
}

export function isNoindex(html: string): boolean {
  return /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html);
}

// ---- minimal parse5 tree helpers -------------------------------------------

type Node = any;
const attr = (n: Node, name: string): string | undefined =>
  n.attrs?.find((a: any) => a.name === name)?.value;
function setAttr(n: Node, name: string, value: string) {
  const a = n.attrs.find((x: any) => x.name === name);
  if (a) a.value = value;
  else n.attrs.push({ name, value });
}
function walk(n: Node, fn: (n: Node) => void) {
  fn(n);
  for (const c of n.childNodes ?? []) walk(c, fn);
  if (n.content) walk(n.content, fn); // <template>
}
function setChildren(n: Node, children: Node[]) {
  for (const c of children) c.parentNode = n;
  n.childNodes = children;
}
const textNode = (value: string) => ({ nodeName: '#text', value });

export function renderMarketingPage(route: MarketingRoute, routes: MarketingRoute[]): string {
  const dict = I18N[route.locale];
  const template = templateFor(route.file);
  const doc = parse(template);
  let html: Node;
  let head: Node;
  walk(doc, (n) => {
    if (n.nodeName === 'html') html = n;
    if (n.nodeName === 'head') head = n;
  });

  setAttr(html!, 'lang', bcp47(route.locale));
  setAttr(html!, 'dir', dict._dir);

  walk(doc, (n) => {
    if (!n.attrs) return;
    let k: string | undefined;
    if ((k = attr(n, 'data-i18n')) && dict[k] != null) setChildren(n, [textNode(dict[k])]);
    if ((k = attr(n, 'data-i18n-html')) && dict[k] != null) setChildren(n, parseFragment(dict[k]).childNodes);
    if ((k = attr(n, 'data-i18n-aria-label')) && dict[k] != null) setAttr(n, 'aria-label', dict[k]);
    if ((k = attr(n, 'data-i18n-alt')) && dict[k] != null) setAttr(n, 'alt', dict[k]);
    if ((k = attr(n, 'data-i18n-content')) && dict[k] != null) setAttr(n, 'content', dict[k]);
  });

  // Self-referencing canonical, and the full hreflang set (only on indexable
  // pages — a noindex page has no alternates to offer). Any the template
  // carries are replaced, so the raw HTML never disagrees with itself.
  const self = `${ORIGIN}/${route.locale}${route.suffix}`;
  const replaced = (c: Node) =>
    c.nodeName === 'link' && (attr(c, 'rel') === 'canonical' || (attr(c, 'rel') === 'alternate' && attr(c, 'hreflang') != null));
  // Drop each replaced link together with the indentation text node before it.
  const kids = head!.childNodes;
  const kept = kids.filter(
    (c: Node, i: number) =>
      !replaced(c) && !(c.nodeName === '#text' && !c.value.trim() && kids[i + 1] && replaced(kids[i + 1])),
  );
  const links: Node[] = [];
  const canonical = { nodeName: 'link', tagName: 'link', attrs: [{ name: 'rel', value: 'canonical' }, { name: 'id', value: 'canonical' }, { name: 'href', value: self }], childNodes: [], namespaceURI: 'http://www.w3.org/1999/xhtml' };
  links.push(canonical);
  if (!isNoindex(template)) {
    const siblings = routes.filter((r) => r.suffix === route.suffix && r.file === route.file);
    const alt = (hreflang: string, href: string) => ({ nodeName: 'link', tagName: 'link', attrs: [{ name: 'rel', value: 'alternate' }, { name: 'hreflang', value: hreflang }, { name: 'href', value: href }], childNodes: [], namespaceURI: 'http://www.w3.org/1999/xhtml' });
    for (const r of siblings) links.push(alt(bcp47(r.locale), `${ORIGIN}/${r.locale}${r.suffix}`));
    if (siblings.some((r) => r.locale === 'en-gb')) links.push(alt('x-default', `${ORIGIN}/en-gb${route.suffix}`));
  }
  // After <meta charset> and the www-redirect script, i.e. where the
  // template's own canonical sat.
  const at = Math.max(0, kept.findIndex((c: Node) => c.nodeName === 'meta' && attr(c, 'name') === 'viewport'));
  const withNl = links.flatMap((l) => [textNode('\n  '), l]);
  setChildren(head!, [...kept.slice(0, at), ...withNl, textNode('\n  '), ...kept.slice(at)]);

  return serialize(doc);
}
