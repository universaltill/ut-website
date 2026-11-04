// The one place that turns the published-locale list (ADR-0177, ut-docs#5406)
// into everything the site needs: which locales exist, each locale's complete
// dictionary (with per-key English fallback), the Static Web Apps route table,
// the my. link locales. Plain ESM with no dependencies so the Astro build
// (src/lib/locales.ts), the generator, the guards and the Playwright specs all
// read the SAME code, and cannot disagree about what the list means.
//
// Inputs (all committed; `sync-locales.yml` will copy them from ut-translations):
//   i18n/en.json, i18n/en.meta.json   English source + key metadata
//   i18n/published/locales.json       ut-translations `published/locales.json`
//   i18n/<url-locale>.json            approved strings (flat key -> text)
// `UT_I18N_DIR` points everything at another directory (the leak fixture).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The repo root. Next to this file when run as a script; the Astro build bundles
// this module into its own output folder, where "next to this file" is wrong, so
// fall back to the directory the build was started from (the repo root).
const HERE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const ROOT = fs.existsSync(path.join(HERE_ROOT, "i18n")) ? HERE_ROOT : process.cwd();
export const SOURCE = "en-gb";
export const SURFACE = "website";

/** Marketing pages and the locale-relative suffix each is served at. */
export const PAGES = [
  { file: "index.html", suffix: "" },
  { file: "download.html", suffix: "/download" },
  { file: "start.html", suffix: "/start" },
  { file: "find-your-setup.html", suffix: "/find-your-setup" },
  { file: "pilot.html", suffix: "/pilot" },
  { file: "android-till.html", suffix: "/android-till" },
  { file: "language.html", suffix: "/language" },
];
/** Locale-relative paths that 301 to the locale root (the store was removed). */
export const REDIRECT_SUFFIXES = ["/store"];
/** Astro-built sections whose index every locale has. */
export const ASTRO_INDEXES = ["/blog/", "/plugins/", "/legal/impressum/", "/legal/privacy/", "/legal/terms/"];

export const i18nDir = () => process.env.UT_I18N_DIR ? path.resolve(process.env.UT_I18N_DIR) : path.join(ROOT, "i18n");

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

export function loadList(dir = i18nDir()) {
  const list = readJson(path.join(dir, "published", "locales.json"));
  if (list.schema !== 1 || !Array.isArray(list.locales)) throw new Error("published/locales.json: expected schema 1 with a locales array");
  return list;
}
export const loadEnglish = (dir = i18nDir()) => readJson(path.join(dir, "en.json"));
export const loadMeta = (dir = i18nDir()) => readJson(path.join(dir, "en.meta.json"));
export function loadStrings(url, dir = i18nDir()) {
  const p = path.join(dir, `${url}.json`);
  return fs.existsSync(p) ? readJson(p) : {};
}

const surfaceOf = (l, name = SURFACE) => (l.surfaces && l.surfaces[name]) || null;

/** Locales the website serves: published for the `website` surface; the English source first, then by English name. */
export function websiteLocales(list) {
  const out = list.locales.filter((l) => l.url === SOURCE || (surfaceOf(l) && surfaceOf(l).published === true));
  for (const l of out) if (!/^[a-z]{2}-[a-z]{2}$/.test(l.url)) throw new Error(`published list: url locale ${JSON.stringify(l.url)} must look like xx-yy (routes and guards rely on it)`);
  if (!out.some((l) => l.url === SOURCE)) throw new Error(`the published list has no ${SOURCE} source locale`);
  return out.sort((a, b) => (a.url === SOURCE ? -1 : b.url === SOURCE ? 1 : String(a.english_name).localeCompare(String(b.english_name))));
}

/** Locales my.universaltill.com serves: `cloud.manage` published. */
export const myLocales = (list) => new Set(list.locales.filter((l) => l.surfaces && l.surfaces.cloud && l.surfaces.cloud.manage && l.surfaces.cloud.manage.published === true).map((l) => l.url));

/** Withdrawn website locales: their old URLs 301 to en-gb. */
export const withdrawnUrls = (list) => (list.withdrawn || []).filter((w) => w.surface === SURFACE).map((w) => w.url);

/** The AI label shows unless a human review is recorded; the source locale never has it. */
export const hasMachineLabel = (l) => l.url !== SOURCE && l.machine_label !== false && l.human_reviewed !== true;

/** Legal text of one document is served translated only when the list approves it. */
export function legalApproved(l, doc) {
  if (l.url === SOURCE) return true;
  const s = surfaceOf(l);
  if (!s) return false;
  if (s.legal && typeof s.legal === "object" && doc in s.legal) return s.legal[doc] === true;
  return s.legal_approved === true;
}

export const bcp47Of = (l) => l.bcp47 || l.url.replace(/-([a-z]+)$/, (_, r) => "-" + r.toUpperCase());

/**
 * Complete dictionary of one locale: every English key, the locale's approved
 * text where it has one, English otherwise. `_fb` lists the keys that fell
 * back. `_name`/`_english`/`_dir`/`_bcp47`/`_label` carry the list's facts.
 */
export function buildDict(l, english, strings) {
  const dict = {};
  const fb = [];
  for (const [k, en] of Object.entries(english)) {
    if (l.url !== SOURCE && typeof strings[k] === "string" && strings[k] !== "") dict[k] = strings[k];
    else { dict[k] = en; if (l.url !== SOURCE) fb.push(k); }
  }
  return { ...dict, _name: l.native_name, _english: l.english_name, _dir: l.dir, _bcp47: bcp47Of(l), _label: hasMachineLabel(l), _fb: fb };
}

export function loadDicts(dir = i18nDir()) {
  const list = loadList(dir);
  const english = loadEnglish(dir);
  const locales = websiteLocales(list);
  const dicts = {};
  for (const l of locales) dicts[l.url] = buildDict(l, english, loadStrings(l.url, dir));
  return { list, english, meta: loadMeta(dir), locales, dicts };
}

// ---- HTML-bearing values (translator-supplied markup) ----------------------
const ALLOWED_TAGS = new Set(["a", "b", "i", "em", "strong", "br", "span", "code"]);
// Attributes per tag: anything not listed is rejected. Only <a href> carries one.
const ALLOWED_ATTRS = { a: new Set(["href"]) };
const TAG = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
const tagSet = (s) => [...String(s).matchAll(TAG)].map((m) => ({ close: m[1] === "/", name: m[2].toLowerCase(), attrs: m[3] }));
// Attribute list the way a browser splits it: whitespace OR "/" separates, so `<code/onmouseover=x>` has one.
const ATTR = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const attrsOf = (raw) => [...String(raw).matchAll(ATTR)].map((m) => ({ name: m[1].toLowerCase(), value: m[2] ?? m[3] ?? m[4] ?? "" }));
const SAFE_HREF = /^(\/|#|https:\/\/|mailto:)/i;

/** Problems with an HTML-bearing value against the allow-list; [] when safe. */
export function htmlProblems(value, english) {
  const out = [];
  if (/<!--|<!\[|<\?/.test(String(value))) out.push("comments, CDATA and processing instructions are not allowed");
  for (const t of tagSet(value)) {
    if (!ALLOWED_TAGS.has(t.name)) { out.push(`tag <${t.name}> is not allowed`); continue; }
    if (t.close) continue;
    for (const at of attrsOf(t.attrs)) {
      if (!(ALLOWED_ATTRS[t.name] && ALLOWED_ATTRS[t.name].has(at.name))) out.push(`<${t.name}> has the attribute ${at.name}, which is not allowed`);
      else if (at.name === "href" && !SAFE_HREF.test(at.value.trim().replace(/[\u0000-\u0020]/g, ""))) out.push(`<a href="${at.value}"> is not a site path, https or mailto link`);
    }
    if (t.name === "a" && !attrsOf(t.attrs).some((x) => x.name === "href")) out.push("<a> without href");
  }
  // Anything that still looks like an unterminated tag would be completed by the browser.
  if (/<[a-zA-Z/]/.test(String(value).replace(TAG, ""))) out.push("unterminated or malformed tag");
  if (english !== undefined) {
    const sig = (s) => tagSet(s).map((t) => (t.close ? "/" : "") + t.name).sort().join(",");
    if (sig(value) !== sig(english)) out.push("tag set differs from the English text");
    const hrefs = (s) => tagSet(s).filter((t) => !t.close).flatMap((t) => attrsOf(t.attrs).filter((a) => a.name === "href").map((a) => a.value)).sort().join("|");
    if (hrefs(value) !== hrefs(english)) out.push("link targets differ from the English text");
  }
  return out;
}

// ---- Static Web Apps route table -------------------------------------------
const LOCALE_PATH = /^\/[a-z]{2}-[a-z]{2}(\/|$)/;
const SHORT_ALIAS = /^\/[a-z]{2}$/;
/** True for a route entry this generator owns (so a regenerate replaces it). */
export const isGeneratedRoute = (r) => LOCALE_PATH.test(r.route) || SHORT_ALIAS.test(r.route);

/**
 * The locale part of the route table for the published list, in a fixed order:
 * per published locale its pages and /store 301; per withdrawn locale 301s to
 * the same page in en-gb; short aliases (/de -> /de-de).
 */
export function localeRoutes(list) {
  const out = [];
  for (const l of websiteLocales(list)) {
    for (const p of PAGES) out.push({ route: `/${l.url}${p.suffix}`, rewrite: `/${l.url}/${p.file}` });
    for (const s of REDIRECT_SUFFIXES) out.push({ route: `/${l.url}${s}`, redirect: `/${l.url}`, statusCode: 301 });
  }
  const seen = new Set();
  for (const l of websiteLocales(list)) {
    const alias = `/${l.url.split("-")[0]}`;
    if (l.url !== SOURCE && !seen.has(alias)) { seen.add(alias); out.push({ route: alias, redirect: `/${l.url}`, statusCode: 301 }); }
  }
  for (const url of withdrawnUrls(list)) {
    if (websiteLocales(list).some((l) => l.url === url)) continue;
    for (const p of PAGES) out.push({ route: `/${url}${p.suffix}`, redirect: `/${SOURCE}${p.suffix}`, statusCode: 301 });
    for (const a of ASTRO_INDEXES) out.push({ route: `/${url}${a}`, redirect: `/${SOURCE}${a}`, statusCode: 301 });
    out.push({ route: `/${url}/*`, redirect: `/${SOURCE}`, statusCode: 301 });
    const alias = `/${url.split("-")[0]}`;
    if (!seen.has(alias)) { seen.add(alias); out.push({ route: alias, redirect: `/${SOURCE}`, statusCode: 301 }); }
  }
  return out;
}

/** The whole config: generated locale routes first, then every hand-kept entry untouched. */
export function buildSwaConfig(existing, list) {
  const kept = (existing.routes || []).filter((r) => !isGeneratedRoute(r));
  return { ...existing, routes: [...localeRoutes(list), ...kept] };
}

export const serializeSwa = (cfg) => JSON.stringify(cfg, null, 2) + "\n";
