// SEO site inventory (ut-docs#6887, ADR-0211 section 3): one row per sitemap URL,
// extracted from the FINAL built HTML in dist/ (after postbuild) so it describes
// what is served. Pure functions except buildInventory, which reads dist/.
// Contract: docs/code-reviews/2026-11-22-seo-inventory-6887.md (until the
// ut-docs reference/contracts/seo-inventory.md lands with the cloud half).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { parse } from "parse5";
import { websiteLocales, SOURCE } from "./locales.mjs";
import { resolveRequest } from "./swa-routes.mjs";

export const SCHEMA_VERSION = "1.0";
export const MAX_BYTES = 31457280; // 30 MiB
const SITE = "https://www.universaltill.com/";
const HOSTS = new Set(["www.universaltill.com", "universaltill.com"]);
const SKIP = new Set(["script", "style", "noscript", "svg", "template"]);
const BLOCK = new Set("address article aside blockquote br dd details dialog div dl dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr li main nav ol p pre section summary table td th tr ul".split(" "));
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function parseSitemapLocs(xml) {
  const dec = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  return [...String(xml).matchAll(/<loc>(.*?)<\/loc>/gs)].map((m) => dec(m[1].trim()));
}

/** Page kind from the path after /<locale>. */
export function kindOf(localePath) {
  if (localePath.startsWith("/blog/")) return "blog";
  if (localePath.startsWith("/legal/")) return "legal";
  if (localePath.startsWith("/help/")) return "help";
  if (localePath.startsWith("/plugins/")) return "plugin";
  if (localePath.startsWith("/claude/")) return "connector";
  return "marketing";
}

/** True for http(s) URLs on exactly our two hosts, no credentials, default port. */
export function isInternal(url) {
  return (url.protocol === "http:" || url.protocol === "https:") && url.username === "" && url.password === "" && url.port === "" && HOSTS.has(url.hostname);
}

// ---- HTML helpers (parse5 default tree) --------------------------------------
const attr = (n, name) => (n.attrs || []).find((a) => a.name === name)?.value;
const hasAttr = (n, name) => (n.attrs || []).some((a) => a.name === name);
const tag = (n) => n.tagName;
function* walkEls(n) {
  for (const c of n.childNodes || []) if (c.tagName) { yield c; yield* walkEls(c); }
}
const text = (n) => (n.childNodes || []).filter((c) => c.nodeName === "#text").map((c) => c.value).join("");
const clean = (s) => { const t = s.replace(/\s+/g, " ").trim().normalize("NFC"); return t === "" ? null : t; };

function collect(n, out) {
  for (const c of n.childNodes || []) {
    if (c.nodeName === "#text") { out.push(c.value); continue; }
    if (!c.tagName || SKIP.has(c.tagName) || hasAttr(c, "hidden")) continue;
    const b = BLOCK.has(c.tagName);
    if (b) out.push(" ");
    collect(c, out);
    if (b) out.push(" ");
  }
}
export function textOf(n) { const out = []; collect(n, out); return clean(out.join("")); }

/** Every field of one page, from its served HTML. `problem` is no_main / multiple_main / undefined. */
export function extractPage(html, { pageUrl, isSource }) {
  const doc = parse(html);
  const els = [...walkEls(doc)];
  const metas = (name) => els.filter((e) => tag(e) === "meta" && (attr(e, "name") || "").toLowerCase() === name);
  const links = (rel) => els.filter((e) => tag(e) === "link" && (attr(e, "rel") || "").toLowerCase().split(/\s+/).includes(rel));
  const titleEl = els.find((e) => tag(e) === "title");
  const mains = els.filter((e) => tag(e) === "main");
  const main = mains.length === 1 ? mains[0] : null;
  const inMain = new Set(main ? [...walkEls(main)] : []);
  const out = {
    title: titleEl ? clean(text(titleEl)) : null,
    description: metas("description")[0] ? clean(attr(metas("description")[0], "content") || "") : null,
    canonical: links("canonical")[0] ? attr(links("canonical")[0], "href") || null : null,
    hreflang: links("alternate").filter((e) => attr(e, "hreflang")).map((e) => ({ hreflang: attr(e, "hreflang"), href: attr(e, "href") ?? null })),
    noindex: metas("robots").some((e) => /noindex/i.test(attr(e, "content") || "")),
    headings: [], bodyText: null, links: [], translated: null, fallbackElements: null,
    problem: mains.length === 0 ? "no_main" : mains.length > 1 ? "multiple_main" : undefined,
  };
  for (const a of els.filter((e) => tag(e) === "a" && hasAttr(e, "href"))) {
    const href = attr(a, "href").trim();
    if (href.startsWith("#") || /^javascript:/i.test(href)) continue;
    let u; try { u = new URL(href, pageUrl); } catch { continue; }
    out.links.push({ href: u.href, area: inMain.has(a) ? "body" : "chrome", internal: isInternal(u), rel: attr(a, "rel") || null });
  }
  if (main) {
    out.bodyText = textOf(main);
    out.headings = [...inMain].filter((e) => /^h[1-3]$/.test(tag(e))).map((e) => ({ level: Number(tag(e)[1]), text: textOf(e) }));
    if (isSource) { out.fallbackElements = 0; out.translated = true; }
    else {
      out.fallbackElements = [...inMain].filter((e) => /^en(-|$)/.test((attr(e, "lang") || "").toLowerCase()) || hasAttr(e, "data-i18n-fallback")).length;
      out.translated = out.fallbackElements === 0;
    }
  }
  return out;
}

// ---- keyword map ---------------------------------------------------------------
export function validateKeywordMap(map, localeUrls) {
  const bad = (m) => { throw new Error(`seo-keyword-map: ${m}`); };
  if (!map || map.schemaVersion !== SCHEMA_VERSION) bad(`schemaVersion must be "${SCHEMA_VERSION}"`);
  if (!Array.isArray(map.terms)) bad("terms must be an array");
  const seen = new Set();
  for (const t of map.terms) {
    const id = JSON.stringify(t.term);
    if (typeof t.term !== "string" || t.term.trim() === "") bad(`empty term ${id}`);
    if (!localeUrls.includes(t.locale)) bad(`${id}: locale ${JSON.stringify(t.locale)} is not a website locale`);
    if (typeof t.owner !== "string" || !t.owner.startsWith("/")) bad(`${id}: owner must start with "/"`);
    if (!Array.isArray(t.supporting) || t.supporting.some((s) => typeof s !== "string" || !s.startsWith("/"))) bad(`${id}: supporting must be an array of paths starting with "/"`);
    if (!/^ut-docs#\d+$/.test(t.card ?? "")) bad(`${id}: card must look like ut-docs#123`);
    const key = `${t.locale}\u0000${t.term.trim().toLowerCase()}`;
    if (seen.has(key)) bad(`duplicate term ${id} for ${t.locale}`);
    seen.add(key);
  }
}

/** Full-path owners (sorted) plus owner_not_in_sitemap problems. */
export function declaredOwners(map, sitemapPaths) {
  const full = (locale, p) => `/${locale}${p === "/" ? "" : p}`;
  const owners = map.terms.map((t) => ({ term: t.term, locale: t.locale, owner: full(t.locale, t.owner), supporting: t.supporting.map((s) => full(t.locale, s)), card: t.card }))
    .sort((a, b) => cmp(a.locale, b.locale) || cmp(a.term, b.term));
  const problems = owners.filter((o) => !sitemapPaths.has(o.owner))
    .map((o) => ({ path: o.owner, code: "owner_not_in_sitemap", message: `owner of "${o.term}" is not a sitemap URL` }));
  return { owners, problems };
}

// ---- the inventory ---------------------------------------------------------------
function defaultGitSha() {
  try { return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null; } catch { return null; }
}

export function buildInventory({ distDir, config, list, map = null, env = {}, now = new Date(), maxBytes = MAX_BYTES, gitSha = defaultGitSha }) {
  const fail = (m) => { throw new Error(`seo-inventory: ${m}`); };
  const locales = websiteLocales(list);
  const urls = locales.map((l) => l.url);
  const sitemaps = fs.readdirSync(distDir).filter((f) => /^sitemap.*\.xml$/.test(f)).sort();
  if (!sitemaps.length) fail(`no sitemap*.xml in ${distDir}`);
  const locs = sitemaps.flatMap((f) => parseSitemapLocs(fs.readFileSync(path.join(distDir, f), "utf8")));
  if (!locs.length) fail("the sitemap has no <loc> entries");

  const problems = [];
  const rows = [];
  const seen = new Set();
  for (const loc of locs) {
    if (!loc.startsWith(SITE)) fail(`sitemap URL ${loc} is not an https://www.universaltill.com/ URL`);
    const p = new URL(loc).pathname;
    if (seen.has(p)) fail(`duplicate sitemap path ${p}`);
    seen.add(p);
    // Look the file up by the decoded path, as serve-site.js and Azure do, so a
    // percent-encoded non-ASCII slug resolves; the row keeps the sitemap's form.
    let dp; try { dp = decodeURIComponent(p); } catch { fail(`sitemap URL ${loc} has a malformed percent-encoding`); }
    const r = resolveRequest(distDir, config, dp);
    if (r.redirect) fail(`sitemap URL ${loc} is a redirect (${r.redirect.status} to ${r.redirect.location})`);
    if (!r.filePath) fail(`sitemap URL ${loc} does not resolve to a built file`);
    const seg = p.split("/")[1] ?? "";
    const locale = urls.includes(seg) ? seg : null;
    if (!locale) problems.push({ path: p, code: "unknown_locale", message: `first path segment ${JSON.stringify(seg)} is not a website locale` });
    const x = extractPage(fs.readFileSync(r.filePath, "utf8"), { pageUrl: loc, isSource: locale === SOURCE });
    if (x.problem) problems.push({ path: p, code: x.problem, message: x.problem === "no_main" ? "page has no <main>" : "page has more than one <main>" });
    delete x.problem;
    rows.push({ path: p, locale, kind: kindOf(locale ? p.slice(locale.length + 1) : p), noindex: x.noindex, title: x.title, description: x.description, canonical: x.canonical, hreflang: x.hreflang, headings: x.headings, bodyText: x.bodyText, links: x.links, translated: x.translated, fallbackElements: x.fallbackElements });
  }
  rows.sort((a, b) => cmp(a.path, b.path));

  let owners = [];
  if (map) {
    validateKeywordMap(map, urls);
    const d = declaredOwners(map, seen);
    owners = d.owners; problems.push(...d.problems);
  }
  const buildSha = env.GITHUB_SHA || gitSha() || null;
  if (!buildSha) problems.push({ path: null, code: "no_build_sha", message: "neither GITHUB_SHA nor git rev-parse HEAD gave a build SHA" });
  problems.sort((a, b) => cmp(a.path ?? "", b.path ?? "") || cmp(a.code, b.code));

  const inv = {
    schemaVersion: SCHEMA_VERSION,
    buildSha,
    deployRunId: env.GITHUB_RUN_ID ? String(env.GITHUB_RUN_ID) : null,
    computedAt: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    contentSha256: crypto.createHash("sha256").update(JSON.stringify({ rows, declaredOwners: owners })).digest("hex"),
    locales: locales.map((l) => ({ code: l.url, bcp47: l.bcp47 ?? null, dir: l.dir ?? null, humanReviewed: l.human_reviewed === true })),
    problems,
    declaredOwners: owners,
    indexNow: [],
    rows,
  };
  const size = Buffer.byteLength(serializeInventory(inv));
  if (size > maxBytes) fail(`inventory is ${size} bytes, over the ${maxBytes}-byte cap`);
  return inv;
}

export const serializeInventory = (obj) => JSON.stringify(obj) + "\n";
