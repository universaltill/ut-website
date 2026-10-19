// The plugins listed on /plugins and their detail pages (ut-docs#4645) — the
// one place "which plugins exist, with what data" is decided. The grid, every
// /<locale>/plugins/<slug>/ page, the sitemap and the logo/screenshot files
// under /plugin-assets/ all read loadPlugins(), so they can't disagree.
//
// Every plugin listed here is free, public, and stays that way — ADR-0027
// (ut-docs) rules out quietly relicensing something already free. It does
// NOT promise every future official plugin is free; a paid one simply
// wouldn't appear here.
//
// hasRelease: false means the repo exists and is browsable but hasn't been
// wired into the release pipeline yet (no packaged download) — shown
// honestly, not hidden and not given a broken download link.
import PLUGIN_LIST from './plugin-list.json';

const ORG = 'universaltill';

// Logos and screenshots are copied into the build and served from this site,
// so the CSP's img-src stays 'self' (scripts/generate-csp.js). Only raster
// formats, checked by their magic bytes: an SVG from a plugin repo, served
// from www.universaltill.com and opened directly, could run script on our
// origin.
const MAX_ICON_BYTES = 512 * 1024;
const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024;
const MAX_SCREENSHOTS = 6;
// A hung GitHub response must not hang the deploy either.
const FETCH_TIMEOUT_MS = 15_000;
const get = (url: string) => fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

export interface PluginAsset {
  /** Path under the site root, e.g. "/plugin-assets/faq/icon.png". */
  path: string;
  bytes: Uint8Array;
  contentType: string;
}

export interface Plugin {
  repo: string;
  slug: string;
  hasRelease: boolean;
  id: string;
  name: string;
  description: string;
  tagline: string;
  type: string;
  version: string;
  author: string;
  minPosVersion: string;
  deviceArch: string;
  permissions: string[];
  /** The letter shown when the plugin ships no icon. */
  letter: string;
  /** 0..5 — which of the letter-mark colours this plugin gets. */
  hue: number;
  icon: PluginAsset | null;
  screenshots: PluginAsset[];
  repoUrl: string;
  releaseUrl: string;
  downloadUrl: string;
}

const RASTER: { type: string; ext: string; sniff: (b: Uint8Array) => boolean }[] = [
  {
    type: 'image/png',
    ext: 'png',
    sniff: (b) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v),
  },
  { type: 'image/jpeg', ext: 'jpg', sniff: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    type: 'image/webp',
    ext: 'webp',
    sniff: (b) =>
      String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP',
  },
];

/** The first sentence of a manifest description — the card's one-liner. */
export function taglineOf(description: string): string {
  const text = description.trim();
  const m = text.match(/^(.+?[.!?])(?=\s|$)/s);
  return m ? m[1] : text;
}

/** The letter mark for a plugin with no icon: the first letter of its name,
 *  skipping a leading "Universal Till" that every official plugin could share. */
export function letterOf(name: string): string {
  const rest = name.replace(/^Universal Till\s+/i, '').trim() || name;
  return (Array.from(rest)[0] ?? '?').toUpperCase();
}

function hueOf(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return h % 6;
}

// A manifest resource path is relative to the repo root. Anything else (an
// absolute URL, "..", a leading slash) is refused rather than fetched.
function safeResourcePath(p: unknown): string | null {
  if (typeof p !== 'string' || p === '' || p.length > 200) return null;
  if (p.startsWith('/') || p.includes('\\') || /^[a-z][a-z0-9+.-]*:/i.test(p)) return null;
  const parts = p.split('/');
  if (parts.some((s) => s === '' || s === '.' || s === '..')) return null;
  return parts.map(encodeURIComponent).join('/');
}

const rawUrl = (repo: string, branch: string, path: string) =>
  `https://raw.githubusercontent.com/${ORG}/${repo}/${branch}/${path}`;

// A failed fetch must NOT be fatal. This runs inside `astro build`, so a throw
// fails the build, which fails the deploy workflow — a transient
// raw.githubusercontent 5xx, rate limiting, or one renamed repo would block
// EVERY website deploy, including urgent download-page fixes. Degrade instead:
// warn, leave that one plugin (or that one picture) out, ship the rest.
async function fetchAsset(
  repo: string,
  branch: string,
  resource: unknown,
  maxBytes: number,
  path: (ext: string) => string,
): Promise<PluginAsset | null> {
  const rel = safeResourcePath(resource);
  if (!rel) {
    if (resource !== undefined) console.warn(`[plugins] ${repo}: ignoring unsafe resource path ${JSON.stringify(resource)}`);
    return null;
  }
  const url = rawUrl(repo, branch, rel);
  try {
    const res = await get(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const declared = Number(res.headers.get('content-length'));
    if (declared > maxBytes) throw new Error(`${declared} bytes, over the ${maxBytes}-byte limit`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > maxBytes) throw new Error(`${bytes.length} bytes, over the ${maxBytes}-byte limit`);
    const kind = RASTER.find((r) => r.sniff(bytes));
    if (!kind) throw new Error('not a PNG, JPEG or WebP image');
    return { path: path(kind.ext), bytes, contentType: kind.type };
  } catch (err) {
    console.warn(`[plugins] ${repo}: skipping ${rel} (${(err as Error).message}) -- ${url}`);
    return null;
  }
}

async function loadOne(p: { repo: string; branch: string; hasRelease: boolean }): Promise<Plugin | null> {
  const url = rawUrl(p.repo, p.branch, 'manifest.json');
  let manifest: Record<string, any>;
  try {
    const res = await get(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    manifest = await res.json();
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('not a JSON object');
  } catch (err) {
    console.warn(`[plugins] skipping ${p.repo}: manifest fetch failed (${(err as Error).message}) -- ${url}`);
    return null;
  }
  const slug = p.repo.replace(/^ut-plugin-/, '');
  const base = `/plugin-assets/${slug}`;
  const resources = manifest.resources ?? {};
  const shots = Array.isArray(resources.screenshots) ? resources.screenshots.slice(0, MAX_SCREENSHOTS) : [];
  const [icon, ...screenshots] = await Promise.all([
    fetchAsset(p.repo, p.branch, resources.icon, MAX_ICON_BYTES, (ext) => `${base}/icon.${ext}`),
    ...shots.map((s: unknown, i: number) =>
      fetchAsset(p.repo, p.branch, s, MAX_SCREENSHOT_BYTES, (ext) => `${base}/screenshot-${i + 1}.${ext}`),
    ),
  ]);
  const name = String(manifest.name ?? slug);
  const description = String(manifest.description ?? '');
  return {
    ...p,
    slug,
    id: String(manifest.id ?? ''),
    name,
    description,
    tagline: taglineOf(description),
    type: String(manifest.canonical_type ?? ''),
    version: String(manifest.version ?? ''),
    author: String(manifest.author ?? ''),
    minPosVersion: String(manifest.min_pos_version ?? ''),
    deviceArch: String(manifest.device_arch ?? ''),
    permissions: Array.isArray(manifest.permissions) ? manifest.permissions.map(String) : [],
    letter: letterOf(name),
    hue: hueOf(String(manifest.id ?? slug)),
    icon,
    screenshots: screenshots.filter((s): s is PluginAsset => s !== null),
    repoUrl: `https://github.com/${ORG}/${p.repo}`,
    // GitHub-native "always current" links: /releases/latest redirects to the
    // newest tag, and every release carries the same latest.tar.gz asset name.
    releaseUrl: `https://github.com/${ORG}/${p.repo}/releases/latest`,
    downloadUrl: `https://github.com/${ORG}/${p.repo}/releases/latest/download/latest.tar.gz`,
  };
}

let cache: Promise<Plugin[]> | undefined;

/** Every plugin whose manifest could be fetched, in plugin-list.json order.
 *  Fetched once per build and shared by every page that asks. */
export function loadPlugins(): Promise<Plugin[]> {
  cache ??= Promise.all(PLUGIN_LIST.map(loadOne)).then((all) => all.filter((p): p is Plugin => p !== null));
  return cache;
}

// The preferred type order on the grid; any other ADR-0002 type follows, so a
// plugin of a type not listed here is never silently dropped.
const TYPE_ORDER = ['payment', 'integration', 'theme', 'language', 'page', 'button'];

export function groupByType(plugins: Plugin[]): [string, Plugin[]][] {
  const byType = new Map<string, Plugin[]>();
  for (const p of plugins) {
    if (!byType.has(p.type)) byType.set(p.type, []);
    byType.get(p.type)!.push(p);
  }
  const order = [...TYPE_ORDER.filter((t) => byType.has(t)), ...[...byType.keys()].filter((t) => !TYPE_ORDER.includes(t))];
  return order.map((t) => [t, byType.get(t)!]);
}

/** What a permission lets the plugin do, as a pluginspage.perm.* key, or null
 *  when there's no plain-language line for it (the raw name is always shown).
 *  Mirrors the till store's wording where the till has one
 *  (universal-till internal/pages/plugin_permission_view.go). */
export function permissionKey(name: string): string | null {
  const exact: Record<string, string> = {
    'pos.tender': 'perm.tender',
    'events:receive': 'perm.events',
    storage: 'perm.storage',
    'net:*': 'perm.net_any',
    'http:lan': 'perm.lan',
    'ui:page': 'perm.page',
    'ui.page': 'perm.page',
    'ui.theme': 'perm.theme',
    'ui.locale': 'perm.locale',
  };
  if (exact[name]) return `pluginspage.${exact[name]}`;
  if (name.startsWith('net:@setting:')) return 'pluginspage.perm.net_setting';
  if (/^net:[a-z0-9.-]+$/i.test(name)) return 'pluginspage.perm.net';
  if (name.startsWith('ui:slot:') && name.length > 'ui:slot:'.length) return 'pluginspage.perm.slot';
  if (name.startsWith('view:') && name.length > 'view:'.length) return 'pluginspage.perm.view';
  return null;
}
