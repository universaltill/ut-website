// The public help pages (ut-docs#5355, part of #4504): which topics exist, in
// which locale, and their HTML. Pure data + Markdown; the Astro pages, the
// image endpoint and the sitemap all read loadHelp(), so they can't disagree.
// The text itself is fetched by ./helpSource.ts from the product repo.
import fs from 'node:fs';
import path from 'node:path';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { ensureHelpSource } from './helpSource';

/** Site locale -> product-repo folder; null = no translation, English stands in. */
export const LOCALE_FOLDER: Record<string, string | null> = {
  'en-gb': 'en',
  'de-de': 'de',
  'tr-tr': 'tr',
  'fa-ir': 'fa',
  'zh-cn': null,
};
export const SOURCE_FOLDER = 'en';
const SOURCE_LOCALE = 'en-gb';

const MAX_IMAGE_BYTES = 1024 * 1024;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface FrontMatter {
  [key: string]: string | number | boolean | string[];
}

export interface Topic {
  slug: string;
  locale: string;
  folder: string;
  title: string;
  section: string;
  order: number;
  summary: string;
  keywords: string[];
  routes: string[];
  /** Front-matter `public`: exactly unquoted true/false, undefined = not
   *  stated, 'invalid' = anything else (treated as NOT public, fail closed). */
  publicFlag: boolean | undefined | 'invalid';
  /** The Markdown body with front-matter (and a leading duplicate H1) removed. */
  body: string;
}

export interface RenderedTopic extends Topic {
  html: string;
}

// ---------------------------------------------------------------------------
// Front-matter. The product's topics use a small, regular subset of YAML:
// `key: value` lines (plain, "double" or 'single' quoted scalars, [a, b]
// lists, numbers, booleans) plus whole-line `#` comments. Anything else is an
// error, not a silent skip: a topic that half-parses must break the build.
// ---------------------------------------------------------------------------
/** Split a `[a, "b, c"]` list body on commas that are outside quotes. */
function splitList(inner: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = '';
  for (const ch of inner) {
    if (q) {
      cur += ch;
      if (ch === q) q = '';
    } else if (ch === '"' || ch === "'") {
      q = ch;
      cur += ch;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function scalar(raw: string): string | number | boolean | string[] {
  const v = raw.trim();
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    if (inner === '') return [];
    return splitList(inner).map((s) => String(scalar(s))).filter((s) => s !== '');
  }
  if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) {
    try {
      return JSON.parse(v);
    } catch {
      return v.slice(1, -1);
    }
  }
  if (v.startsWith("'") && v.endsWith("'") && v.length >= 2) return v.slice(1, -1).replace(/''/g, "'");
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  return v;
}

export function parseFrontMatter(src: string): { data: FrontMatter; raw: Record<string, string>; body: string } {
  const text = src.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
  if (!m) throw new Error('help topic has no front-matter block');
  const data: FrontMatter = {};
  const raw: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    const kv = line.match(/^([A-Za-z_][\w-]*):(?:\s+(.*)|\s*)$/);
    if (!kv) throw new Error(`unsupported front-matter line: ${JSON.stringify(line)}`);
    data[kv[1]] = scalar(kv[2] ?? '');
    raw[kv[1]] = (kv[2] ?? '').trim();
  }
  return { data, raw, body: text.slice(m[0].length) };
}

/** The body without a leading `# Title` line (the page renders its own h1). */
export function stripLeadingH1(body: string): string {
  return body.replace(/^\s*# [^\n]*\n+/, '');
}

/** The topics open with their own summary sentence(s); the page shows the
 *  summary above the screenshot, so drop that exact prefix from the body
 *  rather than printing it twice. Any other text is left alone. */
export function stripSummaryLead(body: string, summary: string): string {
  const b = body.replace(/^\s+/, '');
  if (!b.startsWith(summary)) return body;
  return b.slice(summary.length).replace(/^[ \t]+/, '').replace(/^\n{1}(?=\n)/, '').replace(/^\n+/, '');
}

export function parseTopic(src: string, slug: string, locale: string, folder: string): Topic {
  const { data, raw, body } = parseFrontMatter(src);
  const str = (k: string) => {
    const v = data[k];
    if (typeof v !== 'string' || v.trim() === '') throw new Error(`${folder}/${slug}.md: front-matter "${k}" is missing`);
    return v.trim();
  };
  if (data.id !== slug) throw new Error(`${folder}/${slug}.md: front-matter id ${JSON.stringify(data.id)} does not match the file name`);
  if (typeof data.order !== 'number') throw new Error(`${folder}/${slug}.md: front-matter "order" must be a number`);
  const list = (k: string) => (Array.isArray(data[k]) ? (data[k] as string[]) : []);
  return {
    slug,
    locale,
    folder,
    title: str('title'),
    section: str('section'),
    order: data.order,
    summary: str('summary'),
    keywords: list('keywords'),
    routes: list('routes'),
    publicFlag: raw.public === undefined ? undefined : raw.public === 'true' ? true : raw.public === 'false' ? false : 'invalid',
    body: stripSummaryLead(stripLeadingH1(body), str('summary')),
  };
}

// ---------------------------------------------------------------------------
// Which topics are public.
// ---------------------------------------------------------------------------
export function parseAllowlist(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*$/, '').trim())
    .filter(Boolean);
}

/** The deny list wins over everything; then explicit `public: false`; then
 *  `public: true`; then the allow-list. */
export function isPublic(publicFlag: boolean | undefined | 'invalid', slug: string, allow: ReadonlySet<string>, deny: ReadonlySet<string> = new Set()): boolean {
  if (deny.has(slug)) return false;
  if (publicFlag === false || publicFlag === 'invalid') return false;
  if (publicFlag === true) return true;
  return allow.has(slug);
}

// ---------------------------------------------------------------------------
// Markdown -> HTML.
// ---------------------------------------------------------------------------
type HNode = { type: string; tagName?: string; properties?: Record<string, any>; children?: HNode[]; value?: string };

/** `{{ helpLink "slug" }}` (a template call in the product's own prose):
 *  becomes a normal /help/ link so the rewriter treats it like any other. */
export function resolveHelpLinks(body: string, titleOf: (slug: string) => string | undefined): string {
  return body.replace(/\{\{\s*helpLink\s+"([a-z0-9-]+)"\s*\}\}/g, (_, slug: string) => `[${titleOf(slug) ?? slug}](/help/${slug})`);
}

export interface LinkContext {
  locale: string;
  isPublic: (slug: string) => boolean;
}

/** Rewrite one href. Returns the new href, or null = render the text only. */
export function rewriteHref(href: string, ctx: LinkContext): { href: string; external?: boolean } | null {
  if (href.startsWith('#')) return { href };
  if (/^https:\/\//i.test(href)) return { href, external: true };
  if (/^mailto:/i.test(href)) return { href };
  const m = href.match(/^\/help\/([a-z0-9-]+)\/?(#.*)?$/);
  if (m && ctx.isPublic(m[1])) return { href: `/${ctx.locale}/help/${m[1]}/${m[2] ?? ''}` };
  // A till route, a non-public topic, http:, javascript:, a relative path ...
  return null;
}

function rehypeHelp(ctx: LinkContext) {
  const walk = (node: HNode) => {
    if (!node.children) return;
    const out: HNode[] = [];
    for (const child of node.children) {
      const tag = child.tagName;
      if (tag === 'script' || tag === 'style' || tag === 'iframe' || tag === 'img') continue;
      walk(child);
      if (tag === 'a') {
        const href = String(child.properties?.href ?? '');
        const r = rewriteHref(href, ctx);
        if (!r) {
          out.push(...(child.children ?? []));
          continue;
        }
        child.properties = { href: r.href };
        if (r.external) child.properties.rel = 'noopener';
      } else if (tag === 'table') {
        out.push({ type: 'element', tagName: 'div', properties: { className: ['help-table'] }, children: [child] });
        continue;
      }
      out.push(child);
    }
    node.children = out;
  };
  return (tree: HNode) => walk(tree);
}

export interface Renderer {
  render(body: string): Promise<string>;
}

export async function createRenderer(ctx: LinkContext): Promise<Renderer> {
  const processor = await createMarkdownProcessor({
    syntaxHighlight: false,
    smartypants: false,
    gfm: true,
    // Raw HTML in the source is dropped, never passed through to the page.
    remarkRehype: { allowDangerousHtml: false },
    rehypePlugins: [[rehypeHelp, ctx]] as any,
  });
  return { render: async (body) => (await processor.render(body)).code };
}

// ---------------------------------------------------------------------------
// The whole help centre.
// ---------------------------------------------------------------------------
export interface HelpEntry {
  slug: string;
  /** The English section, which groups the index in every locale. */
  section: string;
  order: number;
  en: RenderedTopic;
  /** Per site locale: that locale's own translation, absent = English stands in. */
  translations: Record<string, RenderedTopic | undefined>;
  /** Screenshot per locale (served path), falling back to the English one. */
  images: Record<string, string | null>;
}

export interface HelpCentre {
  ref: string;
  entries: HelpEntry[]; // public, ordered by `order`
  /** slug -> served image path -> file bytes (deduplicated). */
  imageFiles: Map<string, Uint8Array>;
}

export interface LocalizedEntry {
  entry: HelpEntry;
  topic: RenderedTopic;
  /** English is standing in for a missing translation. */
  isFallback: boolean;
}

export function localized(entry: HelpEntry, locale: string): LocalizedEntry {
  const own = entry.translations[locale];
  return { entry, topic: own ?? entry.en, isFallback: !own && locale !== SOURCE_LOCALE };
}

/** The locales that have a real version of this entry (its hreflang set). */
export function translatedLocales(entry: HelpEntry): string[] {
  return Object.keys(LOCALE_FOLDER).filter((l) => l === SOURCE_LOCALE || entry.translations[l]);
}

/** Previous/next by `order` across the public topics. */
export function neighbours(entries: HelpEntry[], slug: string): { prev?: HelpEntry; next?: HelpEntry } {
  const sorted = [...entries].sort((a, b) => a.order - b.order);
  const i = sorted.findIndex((e) => e.slug === slug);
  return { prev: i > 0 ? sorted[i - 1] : undefined, next: i >= 0 ? sorted[i + 1] : undefined };
}

/** Other topics of the same English section, nearest first, at most `max`. */
export function related(entries: HelpEntry[], slug: string, max = 4): HelpEntry[] {
  const me = entries.find((e) => e.slug === slug);
  if (!me) return [];
  return entries
    .filter((e) => e.section === me.section && e.slug !== slug)
    .sort((a, b) => Math.abs(a.order - me.order) - Math.abs(b.order - me.order) || a.order - b.order)
    .slice(0, max);
}

/** Sections in order of their lowest topic `order`. */
export function groupBySection(entries: HelpEntry[]): { section: string; entries: HelpEntry[] }[] {
  const by = new Map<string, HelpEntry[]>();
  for (const e of [...entries].sort((a, b) => a.order - b.order)) {
    if (!by.has(e.section)) by.set(e.section, []);
    by.get(e.section)!.push(e);
  }
  return [...by].map(([section, es]) => ({ section, entries: es }));
}

/** The PNG bytes, or null (with a warning) when the file is not a usable
 *  PNG: the topic then shows without a screenshot, like plugins.ts. */
function readPng(file: string): Uint8Array | null {
  const bytes = new Uint8Array(fs.readFileSync(file));
  if (bytes.length > MAX_IMAGE_BYTES) {
    console.warn(`[help] WARNING: dropping image ${file}: ${bytes.length} bytes, over the ${MAX_IMAGE_BYTES}-byte limit`);
    return null;
  }
  if (!PNG_MAGIC.every((v, i) => bytes[i] === v)) {
    console.warn(`[help] WARNING: dropping image ${file}: not a PNG`);
    return null;
  }
  return bytes;
}

const SLUG_RE = /^[a-z0-9-]+$/;

/** Read one folder. A file whose name is not a safe slug, or that does not
 *  parse, is skipped with a warning (a product release must not break this
 *  site's deploy); the caller decides what that means for a public topic. */
function readFolder(dir: string, folder: string, locale: string, skipped: Map<string, string>): Map<string, Topic> {
  const out = new Map<string, Topic>();
  const base = path.join(dir, folder);
  if (!fs.existsSync(base)) return out;
  for (const f of fs.readdirSync(base).filter((n) => n.endsWith('.md')).sort()) {
    const slug = f.slice(0, -3);
    if (!SLUG_RE.test(slug)) {
      console.warn(`[help] WARNING: skipping ${folder}/${f}: the slug must match ${SLUG_RE}`);
      skipped.set(`${folder}/${slug}`, 'bad slug');
      continue;
    }
    try {
      out.set(slug, parseTopic(fs.readFileSync(path.join(base, f), 'utf8'), slug, locale, folder));
    } catch (err) {
      console.warn(`[help] WARNING: skipping ${folder}/${f}: ${(err as Error).message}`);
      skipped.set(`${folder}/${slug}`, (err as Error).message);
    }
  }
  return out;
}

export interface HelpManifestTopic {
  slug: string;
  /** Per site locale: the served screenshot the page must show, or null. */
  images: Record<string, string | null>;
}

/** What the build decided is public; scripts/guard-help.mjs checks dist/ against it. */
export interface HelpManifest {
  ref: string;
  topics: HelpManifestTopic[];
}

export function manifestOf(help: HelpCentre): HelpManifest {
  return { ref: help.ref, topics: help.entries.map((e) => ({ slug: e.slug, images: Object.fromEntries(Object.entries(e.images)) })) };
}

function readAllowlist(): string {
  const f = path.resolve(process.cwd(), 'data/help-public-allowlist.txt');
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
}

function readDenylist(): string {
  const f = path.resolve(process.cwd(), 'data/help-public-denylist.txt');
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
}

/** `{k}` -> value, with the value inserted literally (no `$&` patterns). */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, () => v), template);
}

/** Build the help centre from a source directory laid out like web/help. */
export async function buildHelp(dir: string, ref: string, allowText: string | null = readAllowlist(), denyText: string | null = readDenylist()): Promise<HelpCentre> {
  const deny = new Set(parseAllowlist(denyText ?? ''));
  const allowList = parseAllowlist(allowText ?? '');
  const skipped = new Map<string, string>();
  const allow = new Set(allowList);
  const enTopics = readFolder(dir, SOURCE_FOLDER, SOURCE_LOCALE, skipped);
  // The allow-list is advisory: a product release that renames, removes or
  // un-publishes a listed topic must not break the website deploy. Say so loudly.
  for (const slug of allowList) {
    const t = enTopics.get(slug);
    if (!t) console.warn(`[help] WARNING: data/help-public-allowlist.txt lists "${slug}", which is missing or unreadable in ${SOURCE_FOLDER}/ at ${ref}; not published`);
    else if (t.publicFlag === false) console.warn(`[help] WARNING: "${slug}" is in the allow-list but is public: false upstream; not published`);
  }
  for (const t of enTopics.values()) {
    if (t.publicFlag === 'invalid') console.warn(`[help] WARNING: ${SOURCE_FOLDER}/${t.slug}.md has a "public" value that is not exactly true or false; treated as NOT public`);
  }
  const publicSlugs = new Set([...enTopics.values()].filter((t) => isPublic(t.publicFlag, t.slug, allow, deny)).map((t) => t.slug));
  const byLocaleRaw: Record<string, Map<string, Topic>> = {};
  for (const [locale, folder] of Object.entries(LOCALE_FOLDER)) {
    if (folder && folder !== SOURCE_FOLDER) byLocaleRaw[locale] = readFolder(dir, folder, locale, skipped);
  }
  const titleOf = (locale: string) => (slug: string) => (byLocaleRaw[locale]?.get(slug) ?? enTopics.get(slug))?.title;

  const renderers: Record<string, Renderer> = {};
  for (const locale of Object.keys(LOCALE_FOLDER)) {
    renderers[locale] = await createRenderer({ locale, isPublic: (s) => publicSlugs.has(s) });
  }
  const renderTopic = async (t: Topic, locale: string): Promise<RenderedTopic> => ({
    ...t,
    html: await renderers[locale].render(resolveHelpLinks(t.body, titleOf(locale))),
  });

  const imageFiles = new Map<string, Uint8Array>();
  const imageFor = (folder: string, slug: string): string | null => {
    const file = path.join(dir, 'img', folder, `${slug}.png`);
    if (!fs.existsSync(file)) return null;
    const served = `/help-img/${folder}/${slug}.png`;
    if (!imageFiles.has(served)) {
      const bytes = readPng(file);
      if (!bytes) return null;
      imageFiles.set(served, bytes);
    }
    return served;
  };

  const entries: HelpEntry[] = [];
  for (const en of [...enTopics.values()].filter((t) => publicSlugs.has(t.slug)).sort((a, b) => a.order - b.order)) {
    const translations: Record<string, RenderedTopic | undefined> = {};
    const images: Record<string, string | null> = {};
    const enImage = imageFor(SOURCE_FOLDER, en.slug);
    for (const [locale, folder] of Object.entries(LOCALE_FOLDER)) {
      const own = folder && folder !== SOURCE_FOLDER ? byLocaleRaw[locale].get(en.slug) : undefined;
      if (own) translations[locale] = await renderTopic(own, locale);
      images[locale] = (folder && imageFor(folder, en.slug)) || enImage;
    }
    translations[SOURCE_LOCALE] = await renderTopic(en, SOURCE_LOCALE);
    entries.push({ slug: en.slug, section: en.section, order: en.order, en: translations[SOURCE_LOCALE]!, translations, images });
  }
  return { ref, entries, imageFiles };
}

let cache: Promise<HelpCentre> | undefined;

/** The build's own list of public topics, for scripts/guard-help.mjs, so the
 *  guard never depends on the allow-list file. HELP_MANIFEST overrides the path. */
function writeManifest(help: HelpCentre) {
  const file = path.resolve(process.cwd(), process.env.HELP_MANIFEST || '.help-build/manifest.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(manifestOf(help), null, 1) + '\n');
}

/** Every public topic, once per build. Fails the build if the source is unavailable. */
export function loadHelp(): Promise<HelpCentre> {
  cache ??= ensureHelpSource()
    .then((s) => buildHelp(s.dir, s.ref))
    .then((help) => {
      writeManifest(help);
      return help;
    });
  return cache;
}

/** A meta description from a topic summary: whole words, at most `max` chars. */
export function metaDescription(summary: string, max = 160): string {
  const t = summary.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.\-]+$/, '')}\u2026`;
}

/** A stable in-page id for an English section name. */
export function sectionId(section: string): string {
  return 'sec-' + (section.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x');
}

/** A section's name in `locale`: taken from a translated topic of the group
 *  where one exists, else the English name. */
export function sectionLabel(group: HelpEntry[], locale: string): { label: string; isFallback: boolean } {
  const own = group.map((e) => e.translations[locale]).find((t) => t && locale !== SOURCE_LOCALE);
  return own ? { label: own.section, isFallback: false } : { label: group[0].en.section, isFallback: locale !== SOURCE_LOCALE };
}
