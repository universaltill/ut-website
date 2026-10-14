// /llms.txt and /llms-full.txt (llmstxt.org) — ut-docs#4319.
//
// A plain-Markdown map of the site for AI assistants. Generated at build from
// the same sources the pages render from — site/i18n.js's English dict, each
// marketing template's own section order, the route table, and the blog/legal
// collections — never a hand-kept copy that drifts (the sitemap's rule,
// ut-docs#482). English only, per the llms.txt convention; the other locales
// are listed as links. Every link is absolute: a model reading the file has
// no base URL (and the site's rule is final URLs only, ut-docs#3798).
import { parse } from 'parse5';
import { LANGS, SOURCE_LOCALE } from '../layouts/BaseLayout.astro';
import { getAllLocalizedPosts } from './blogPosts';
import { getAllLocalizedLegalPages } from './legalPages';
import { I18N, ORIGIN, faqNumbers, isNoindex, marketingRoutes, templateFor } from './marketingPages';

const EN = I18N[SOURCE_LOCALE];
const url = (p: string) => `${ORIGIN}/${SOURCE_LOCALE}${p}`;

/** Dict values may carry inline HTML (`data-i18n-html`); flatten to text. */
const text = (s: string) =>
  s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** Root-relative Markdown links → absolute. */
const absolute = (md: string) => md.replace(/\]\(\//g, `](${ORIGIN}/`);

type Node = any;
const attr = (n: Node, name: string) => n.attrs?.find((a: any) => a.name === name)?.value;

/** The indexable English marketing pages, in route-table order. */
function englishPages() {
  return marketingRoutes().filter((r) => r.locale === SOURCE_LOCALE && !isNoindex(templateFor(r.file)));
}
const metaKey = (file: string) => (file === 'index.html' ? 'home' : file.replace(/\.html$/, ''));

/**
 * A marketing page's English copy as Markdown, in the template's own order:
 * h1 → `###`, h2 → `####`, h3/summary/b → bold, the rest paragraphs (nested
 * under the page's own `##` heading). Only <main> — nav and footer chrome is
 * skipped, and so are links (buttons), which carry no content of their own.
 */
export function pageMarkdown(file: string): string {
  const doc = parse(templateFor(file));
  const out: string[] = [];
  let inMain = false;
  const walk = (n: Node) => {
    if (n.nodeName === 'main') inMain = true;
    const key = attr(n, 'data-i18n') ?? attr(n, 'data-i18n-html');
    if (inMain && key && EN[key] != null && n.nodeName !== 'a' && n.nodeName !== 'button') {
      const t = text(EN[key]);
      if (n.nodeName === 'h1') out.push(`### ${t}`);
      else if (n.nodeName === 'h2') out.push(`#### ${t}`);
      else if (['h3', 'summary', 'b'].includes(n.nodeName)) out.push(`**${t}**`);
      else out.push(t);
    }
    for (const c of n.childNodes ?? []) walk(c);
    if (n.nodeName === 'main') inMain = false;
  };
  walk(doc);
  return out.join('\n\n');
}

/**
 * A blog post body for inclusion under `### <title>`: its own headings
 * demoted below that, links made absolute. Posts are plain Markdown today; an
 * MDX import or component would leak source into the file, so fail the build.
 */
function postBody(body: string, slug: string): string {
  if (/^import\s|<[A-Z][A-Za-z]*[\s/>]/m.test(body)) {
    throw new Error(`llmsText: blog post ${slug} uses MDX imports/components — render them to Markdown before publishing in llms-full.txt`);
  }
  return absolute(body.trim().replace(/^(#{1,4}) /gm, '###$1 '));
}

export async function llmsTxt(): Promise<string> {
  const posts = (await getAllLocalizedPosts())[SOURCE_LOCALE];
  const legal = (await getAllLocalizedLegalPages())[SOURCE_LOCALE];
  const faqs = faqNumbers(templateFor('index.html'));
  return [
    '# Universal Till',
    '',
    `> ${text(EN['meta.home.desc'])}`,
    '',
    `${text(EN['hero.lede'])} ${text(EN['about.body'])}`,
    '',
    '## Key pages',
    '',
    ...englishPages().map((r) => `- [${text(EN[`meta.${metaKey(r.file)}.title`])}](${url(r.suffix)}): ${text(EN[`meta.${metaKey(r.file)}.desc`])}`),
    `- [${text(EN['plugins.title'])}](${url('/plugins/')}): ${text(EN['plugins.lede'])}`,
    `- [Blog](${url('/blog/')}): news and guides for shop owners`,
    '- [Source code](https://github.com/universaltill/universal-till): MIT licensed',
    '',
    ...(faqs.length
      ? ['## FAQ', '', ...faqs.map((n) => `- [${text(EN[`faq.q${n}`])}](${url('#faq')}): ${text(EN[`faq.a${n}`])}`), '']
      : []),
    '## Blog',
    '',
    ...posts.map(({ post, slug }) => `- [${post.data.title}](${url(`/blog/${slug}/`)}): ${post.data.excerpt}`),
    '',
    '## Legal',
    '',
    ...legal.map(({ page, slug }) => `- [${page.data.title}](${url(`/legal/${slug}/`)}): ${page.data.summary}`),
    '',
    '## Other languages',
    '',
    ...LANGS.filter((l) => l !== SOURCE_LOCALE).map((l) => `- [${I18N[l]?._name ?? l}](${ORIGIN}/${l})`),
    '',
    '## Contact',
    '',
    '- [Email](mailto:support@universaltill.com): support@universaltill.com',
    '',
    '## Optional',
    '',
    `- [Full content](${ORIGIN}/llms-full.txt): every English marketing page and blog post in full, as Markdown`,
    `- [Sitemap](${ORIGIN}/sitemap.xml)`,
    '',
  ].join('\n');
}

export async function llmsFullTxt(): Promise<string> {
  const posts = (await getAllLocalizedPosts())[SOURCE_LOCALE];
  return [
    '# Universal Till',
    '',
    `> ${text(EN['meta.home.desc'])}`,
    '',
    ...englishPages().flatMap((r) => [
      `## ${text(EN[`meta.${metaKey(r.file)}.title`])}`,
      '',
      url(r.suffix),
      '',
      absolute(pageMarkdown(r.file)),
      '',
    ]),
    '## Blog',
    '',
    ...posts.flatMap(({ post, slug }) => [
      `### ${post.data.title}`,
      '',
      `${url(`/blog/${slug}/`)} — ${post.data.date.toISOString().slice(0, 10)}`,
      '',
      postBody(post.body ?? '', slug),
      '',
    ]),
  ].join('\n');
}
