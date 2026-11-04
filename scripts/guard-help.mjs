#!/usr/bin/env node
// Post-build guard for the public help pages (ut-docs#5355). Run after
// `npx astro build` (CI `build` job); reads dist/ only.
//   node scripts/guard-help.mjs [dist-dir]
// The expected topics come from the BUILD's own manifest
// (.help-build/manifest.json, written by src/lib/help.ts loadHelp()), never from
// data/help-public-allowlist.txt: a product release that changes what is public
// must not break the deploy, and this guard must survive deleting that file.
// Env: HELP_GUARD_MANIFEST (path), HELP_GUARD_MIN_TOPICS (default 10),
// HELP_GUARD_LOCALES (comma list, tests).
// Checks:
//   0. the manifest has at least MIN_TOPICS topics (zero is always an error);
//   1. every public topic exists in en-gb, and every locale has the index and
//      every topic URL (an English stand-in counts, no 404);
//   2. every internal href/src/canonical/hreflang on a help page that points
//      into /<locale>/help/ or /help-img/ resolves to a file in dist/, and a
//      #fragment resolves to an id on that target page (the chrome's links to
//      marketing pages are covered by tests/internal-links.spec.js);
//   3. no orphan image under dist/help-img, no referenced one missing;
//   4. no front-matter / template leakage in the rendered text;
//   5. the fiscal-compliance wording denylist of scripts/guard-compliance-claims.sh
//      (ut-docs#667) over the rendered help text - a topic that trips it must be
//      taken out of data/help-public-allowlist.txt, not edited here;
//   6. sitemap.xml lists every help page that is its own canonical and none
//      that canonicalises elsewhere (ut-docs#3811).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadList, websiteLocales } from "./lib/locales.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, "..");
const dist = path.resolve(process.argv[2] ?? path.join(repo, "dist"));
const ORIGIN = "https://www.universaltill.com";

function locales() {
  if (process.env.HELP_GUARD_LOCALES) return process.env.HELP_GUARD_LOCALES.split(",");
  // The published-locale list (ADR-0177) is the only source of the locale set.
  return websiteLocales(loadList()).map((l) => l.url);
}
const LOCALES = locales();
const errors = [];
const fail = (m) => errors.push(m);
const read = (f) => fs.readFileSync(f, "utf8");

const manifestFile = process.env.HELP_GUARD_MANIFEST ?? path.join(repo, ".help-build/manifest.json");
let manifest = { topics: [] };
try {
  manifest = JSON.parse(read(manifestFile));
} catch (e) {
  fail(`cannot read the build manifest ${manifestFile} (${e.message}); run the build first`);
}
const TOPICS = Array.isArray(manifest.topics) ? manifest.topics : [];
const SLUGS = TOPICS.map((t) => t.slug);
const MIN_TOPICS = Number(process.env.HELP_GUARD_MIN_TOPICS ?? 10);
if (manifestFile && SLUGS.length === 0 && errors.length === 0) fail("the build manifest lists no public topics");
else if (SLUGS.length < MIN_TOPICS && errors.length === 0) fail(`only ${SLUGS.length} public topics; expected at least ${MIN_TOPICS}`);

// 1. presence
const pages = []; // { locale, rel, file, html }
for (const loc of LOCALES) {
  const idx = path.join(dist, loc, "help", "index.html");
  if (!fs.existsSync(idx)) fail(`missing ${loc}/help/index.html`);
  else pages.push({ locale: loc, rel: `/${loc}/help/`, file: idx, html: read(idx) });
  for (const slug of SLUGS) {
    const f = path.join(dist, loc, "help", slug, "index.html");
    if (!fs.existsSync(f)) fail(`missing ${loc}/help/${slug}/index.html`);
    else pages.push({ locale: loc, rel: `/${loc}/help/${slug}/`, file: f, html: read(f), slug });
  }
}
for (const slug of SLUGS) {
  if (!fs.existsSync(path.join(dist, "en-gb", "help", slug, "index.html"))) fail(`public topic ${slug} has no en-gb page`);
}

// 2. references
const idCache = new Map();
function idsOf(file) {
  if (!idCache.has(file)) idCache.set(file, new Set([...read(file).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  return idCache.get(file);
}
const attrRefs = (html) => {
  const out = [];
  for (const m of html.matchAll(/<(?:a|img|script|link)\b[^>]*>/g)) {
    for (const a of m[0].matchAll(/\s(?:href|src)="([^"]*)"/g)) out.push(a[1]);
  }
  return out;
};
const referencedImages = new Set();
for (const p of pages) {
  for (let ref of attrRefs(p.html)) {
    ref = ref.replace(/&amp;/g, "&");
    if (ref.startsWith(ORIGIN)) ref = ref.slice(ORIGIN.length) || "/";
    if (!ref.startsWith("/") || ref.startsWith("//")) continue;
    const [pathname, frag] = [ref.split("#")[0].split("?")[0], ref.includes("#") ? ref.slice(ref.indexOf("#") + 1) : ""];
    if (pathname.startsWith("/help-img/")) {
      referencedImages.add(pathname);
      if (!fs.existsSync(path.join(dist, pathname))) fail(`${p.rel}: image ${pathname} not in dist`);
      continue;
    }
    if (!/^\/[a-z]{2}-[a-z]{2}\/help\//.test(pathname) && pathname !== "/help.js") continue;
    const file = pathname.endsWith("/") ? path.join(dist, pathname, "index.html") : path.join(dist, pathname);
    if (!fs.existsSync(file)) fail(`${p.rel}: link to ${ref} resolves to no file`);
    else if (frag && file.endsWith(".html") && !idsOf(file).has(decodeURIComponent(frag))) fail(`${p.rel}: link ${ref} has no #${frag} on the target`);
  }
  // a screenshot the build decided to show must be on the page
  const want = p.slug && TOPICS.find((t) => t.slug === p.slug)?.images?.[p.locale];
  if (want && !attrRefs(p.html).includes(want)) fail(`${p.rel}: expected image ${want} is not on the page`);
  // fragment-only links
  for (const m of p.html.matchAll(/<a\b[^>]*\shref="#([^"]+)"/g)) {
    if (!idsOf(p.file).has(decodeURIComponent(m[1]))) fail(`${p.rel}: in-page link #${m[1]} has no matching id`);
  }
  const canon = p.html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1];
  if (!canon) fail(`${p.rel}: no canonical`);
  p.canonical = canon;
  // hreflang alternates must exist
  for (const m of p.html.matchAll(/<link[^>]*hreflang="[^"]+"[^>]*href="([^"]+)"/g)) {
    const u = m[1].startsWith(ORIGIN) ? m[1].slice(ORIGIN.length) : m[1];
    if (!fs.existsSync(path.join(dist, u, "index.html"))) fail(`${p.rel}: hreflang target ${u} missing`);
  }
}

// 3. images
const imgDir = path.join(dist, "help-img");
if (fs.existsSync(imgDir)) {
  for (const f of fs.readdirSync(imgDir, { recursive: true })) {
    const full = path.join(imgDir, f);
    if (fs.statSync(full).isFile() && !referencedImages.has(`/help-img/${f.split(path.sep).join("/")}`)) fail(`orphan image /help-img/${f}`);
  }
}

// 4. leakage (visible text and attributes)
for (const p of pages) {
  const text = p.html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
  for (const [re, what] of [
    [/\{\{|\}\}/, "template braces"],
    [/^\s*(title|keywords|order|routes|summary|section|public):/m, "front-matter key at line start"],
    [/<p>---<\/p>|^---$/m, "front-matter fence"],
  ]) {
    if (re.test(text)) fail(`${p.rel}: leaked ${what}`);
  }
}

// 5. compliance denylist (terms are read from the shell guard: one list)
const termsSrc = read(process.env.HELP_GUARD_TERMS ?? path.join(here, "guard-compliance-claims.sh"));
const termsBlock = termsSrc.match(/FORBIDDEN_TERMS=\(([\s\S]*?)\n\)/)?.[1];
if (!termsBlock) fail("cannot read FORBIDDEN_TERMS from guard-compliance-claims.sh");
const terms = [...(termsBlock ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1].toLowerCase());
for (const p of pages) {
  const text = p.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").toLowerCase();
  for (const term of terms) if (text.includes(term)) fail(`${p.rel}: forbidden compliance claim "${term}" - unpublish the topic upstream`);
}

// 6. sitemap
const sitemapFile = path.join(dist, "sitemap.xml");
if (!fs.existsSync(sitemapFile)) fail("no sitemap.xml");
else {
  const listed = new Set([...read(sitemapFile).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
  for (const p of pages) {
    const url = ORIGIN + p.rel;
    const self = p.canonical === url;
    if (self && !listed.has(url)) fail(`sitemap lacks ${url}`);
    if (!self && listed.has(url)) fail(`sitemap lists ${url}, which canonicalises to ${p.canonical}`);
  }
}

if (errors.length) {
  console.error(`guard-help: ${errors.length} problem(s)`);
  for (const e of errors.slice(0, 80)) console.error("  - " + e);
  process.exit(1);
}
console.log(`guard-help: OK (${pages.length} pages, ${LOCALES.length} locales, ${SLUGS.length} topics, ${referencedImages.size} images)`);
