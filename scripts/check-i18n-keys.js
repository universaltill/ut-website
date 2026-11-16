#!/usr/bin/env node
// Guards against the download.html regression found 2026-07-31 (ut-docs#132):
// a data-i18n key used in an HTML page but absent from every I18N language
// dict silently falls back to the page's static source text in ALL locales
// (I18N.apply() only overwrites textContent when the dict lookup is
// non-null) — a page can look "translated" while actually being English-only.
// data-i18n-aria-label (ut-docs#467) is the same class of gap one level
// down: an untranslated aria-label leaks English to screen-reader users
// even when the visible text is fully translated, so it's scanned the same
// way as data-i18n/data-i18n-html.
// Also scans src/**/*.astro (ut-docs#467 review finding 3): BaseLayout.astro
// shares the exact same header markup/keys as site/*.html (it's how the
// Astro-rendered /blog and /plugins pages get the same nav), so a key used
// only there was previously invisible to this guard entirely — not just for
// data-i18n-aria-label, the same blind spot already existed for plain
// data-i18n/data-i18n-html in .astro files before this fix.
// Since the ADR-0177 cutover (ut-docs#5406) the English source is
// i18n/en.json and each locale ships only its approved keys; a locale that
// lacks a key shows the English text by design (per-key fallback). So this
// guard now checks the one thing that can still fail silently: a key used in
// a page that is missing from en.json (it would render the template's
// hard-coded text in every locale and have nothing for translators to
// translate), and a string file with a key en.json does not have.
// ESM, not CommonJS: package.json declares "type": "module" (required by the
// Astro build), so `require`/`__dirname` are not defined in this scope. This
// file kept its .js extension and was converted rather than renamed to .cjs,
// so the repo stays one module system throughout.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.join(scriptDir, "..", "site");
const srcDir = path.join(scriptDir, "..", "src");
const i18nDir = process.env.UT_I18N_DIR || path.join(scriptDir, "..", "i18n");
const en = JSON.parse(fs.readFileSync(path.join(i18nDir, "en.json"), "utf8"));

const htmlFiles = fs.readdirSync(siteDir).filter((f) => f.endsWith(".html"));
const astroFiles = fs.readdirSync(srcDir, { recursive: true })
  .filter((f) => f.endsWith(".astro"))
  .map((f) => path.join(srcDir, f));
const scannedFiles = [...htmlFiles.map((f) => path.join(siteDir, f)), ...astroFiles];

const used = new Set();
for (const f of scannedFiles) {
  const html = fs.readFileSync(f, "utf8");
  for (const m of html.matchAll(/data-i18n(?:-html|-aria-label|-alt|-content)?="([^"]+)"/g)) used.add(m[1]);
}
if (used.size === 0) {
  console.error("check-i18n-keys: found zero data-i18n usages across site/*.html or src/**/*.astro — the extraction regex is broken, not the site");
  process.exit(1);
}

let failed = false;
const missing = [...used].filter((k) => !Object.hasOwn(en, k)).sort();
if (missing.length) {
  failed = true;
  console.error(`missing ${missing.length} key(s) used in HTML from i18n/en.json: ${missing.join(", ")}`);
}
const stringFiles = fs.readdirSync(i18nDir).filter((f) => /^[a-z]{2}-[a-z]{2}\.json$/.test(f));
for (const f of stringFiles) {
  const strings = JSON.parse(fs.readFileSync(path.join(i18nDir, f), "utf8"));
  const extra = Object.keys(strings).filter((k) => !Object.hasOwn(en, k)).sort();
  if (extra.length) { failed = true; console.error(`[${f}] keys that are not in en.json: ${extra.join(", ")}`); }
}

if (failed) {
  console.error("check-i18n-keys: FAILED");
  process.exit(1);
}
console.log(`check-i18n-keys: OK (${stringFiles.length} string files, ${used.size} keys used across ${scannedFiles.length} pages)`);
