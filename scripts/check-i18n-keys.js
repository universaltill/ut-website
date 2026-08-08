#!/usr/bin/env node
// Guards against the download.html regression found 2026-07-31 (ut-docs#132):
// a data-i18n key used in an HTML page but absent from every I18N language
// dict silently falls back to the page's static source text in ALL locales
// (I18N.apply() only overwrites textContent when the dict lookup is
// non-null) — a page can look "translated" while actually being English-only.
// Fails non-zero if any data-i18n key used in site/*.html is missing from
// any language dict, or if the language dicts don't share the same key set.
// ESM, not CommonJS: package.json declares "type": "module" (required by the
// Astro build), so `require`/`__dirname` are not defined in this scope. This
// file kept its .js extension and was converted rather than renamed to .cjs,
// so the repo stays one module system throughout.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.join(scriptDir, "..", "site");
const i18nSrc = fs.readFileSync(path.join(siteDir, "i18n.js"), "utf8");
const match = i18nSrc.match(/const I18N = (\{[\s\S]*?\});\s*\n\s*\(function/);
if (!match) {
  console.error("check-i18n-keys: could not locate the I18N object literal in i18n.js");
  process.exit(1);
}
const I18N = (0, eval)("(" + match[1] + ")");
const langs = Object.keys(I18N);

const htmlFiles = fs.readdirSync(siteDir).filter((f) => f.endsWith(".html"));
const used = new Set();
for (const f of htmlFiles) {
  const html = fs.readFileSync(path.join(siteDir, f), "utf8");
  for (const m of html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)) used.add(m[1]);
}
if (used.size === 0) {
  console.error("check-i18n-keys: found zero data-i18n usages across site/*.html — the extraction regex is broken, not the site");
  process.exit(1);
}

let failed = false;

for (const lang of langs) {
  const missing = [...used].filter((k) => !Object.hasOwn(I18N[lang], k)).sort();
  if (missing.length) {
    failed = true;
    console.error(`[${lang}] missing ${missing.length} key(s) used in HTML: ${missing.join(", ")}`);
  }
}

const keySets = langs.map((l) => new Set(Object.keys(I18N[l]).filter((k) => !k.startsWith("_"))));
const base = keySets[0];
langs.forEach((lang, i) => {
  if (i === 0) return;
  const ks = keySets[i];
  const missing = [...base].filter((k) => !ks.has(k)).sort();
  const extra = [...ks].filter((k) => !base.has(k)).sort();
  if (missing.length || extra.length) {
    failed = true;
    if (missing.length) console.error(`[${lang}] missing vs ${langs[0]}: ${missing.join(", ")}`);
    if (extra.length) console.error(`[${lang}] extra vs ${langs[0]}: ${extra.join(", ")}`);
  }
});

if (failed) {
  console.error("check-i18n-keys: FAILED");
  process.exit(1);
}
console.log(`check-i18n-keys: OK (${langs.length} locales, ${used.size} keys used across ${htmlFiles.length} pages)`);
