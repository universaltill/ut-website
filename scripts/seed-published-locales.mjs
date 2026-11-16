#!/usr/bin/env node
// ONE-TIME seed (ADR-0177 slice 4, ut-docs#5406). Weblate has no `website`
// component yet, so the five locales that are live today are converted from
// the hand dictionaries of site/i18n.js into the files `ut-translations`
// will publish: i18n/<url-locale>.json (approved strings) and
// i18n/published/locales.json (the schema-1 list). The future
// `sync-locales.yml` overwrites exactly these files from ut-translations@main;
// until then this seed is the stand-in.
//
// Rules applied (ADR-0177 section 2): the English source is en.json; every
// other locale is machine-labelled (no human reviewer is recorded),
// legal_approved is false, and `legal`-tier keys are OMITTED for non-English
// locales (English is shown instead, per-key fallback).
//
//   node scripts/seed-published-locales.mjs --dicts <path to a site/i18n.js with the I18N dicts>
//
// Not re-runnable from the current tree: site/i18n.js no longer holds the
// dictionaries after the cutover (use the git history of PR #5406).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const di = args.indexOf("--dicts");
if (di < 0) { console.error("usage: seed-published-locales.mjs --dicts <i18n.js>"); process.exit(2); }
const src = fs.readFileSync(path.resolve(args[di + 1]), "utf8");
const m = src.match(/const I18N = (\{[\s\S]*?\});\s*\n\s*\(function/);
if (!m) throw new Error("no I18N literal found");
const I18N = (0, eval)("(" + m[1] + ")");

const en = JSON.parse(fs.readFileSync(path.join(root, "i18n/en.json"), "utf8"));
const meta = JSON.parse(fs.readFileSync(path.join(root, "i18n/en.meta.json"), "utf8"));
const added = JSON.parse(fs.readFileSync(path.join(root, "scripts/seed-new-keys.json"), "utf8"));

// Weblate code, ISO region facts and which locales my.universaltill.com serves
// today (ut-my-shop/src/i18n/i18n.ts), as of the seed.
const FACTS = {
  "en-gb": { code: "en", bcp47: "en-GB", my: true },
  "de-de": { code: "de", bcp47: "de-DE", my: true },
  "tr-tr": { code: "tr", bcp47: "tr-TR", my: true },
  "zh-cn": { code: "zh_Hans", bcp47: "zh-CN", my: false },
  "fa-ir": { code: "fa", bcp47: "fa-IR", my: true },
};

const isLegal = (k) => meta[k] && meta[k].review === "legal";
const locales = [];
for (const [url, dict] of Object.entries(I18N)) {
  const f = FACTS[url];
  const isSrc = url === "en-gb";
  const strings = {};
  if (!isSrc) {
    const extra = added[url] || {};
    for (const k of Object.keys(en)) {
      const v = k in extra ? extra[k] : dict[k];
      if (typeof v === "string" && v !== "" && !isLegal(k)) strings[k] = v;
    }
    fs.writeFileSync(path.join(root, `i18n/${url}.json`), JSON.stringify(strings, null, 2) + "\n");
  }
  const total = Object.keys(en).length;
  const legalKeys = Object.keys(en).filter(isLegal).length;
  const approved = isSrc ? total : Object.keys(strings).length;
  const legalOut = isSrc ? 0 : legalKeys;
  locales.push({
    code: f.code, weblate: f.code, url, bcp47: f.bcp47, dir: dict._dir,
    english_name: dict._english, native_name: dict._name,
    published: true, reason: "",
    human_reviewed: isSrc, machine_label: !isSrc, review_verified: false,
    legal_approved: isSrc,
    surfaces: {
      website: {
        published: true, approved, total, coverage: +(approved / (total - legalOut)).toFixed(4), core_ok: true,
        omitted_broken: 0, omitted_legal: legalOut, omitted: legalOut ? { legal_english_only: legalOut } : {},
        legal_approved: isSrc, legal_keys: legalKeys, review_verified: false,
      },
      ...(f.my ? { cloud: { manage: { published: true } } } : {}),
    },
  });
}
const doc = { schema: 1, generated_at: "2026-11-04T00:00:00Z", source_commit: "seed-from-site-i18n-js", locales, withdrawn: [] };
fs.mkdirSync(path.join(root, "i18n/published"), { recursive: true });
fs.writeFileSync(path.join(root, "i18n/published/locales.json"), JSON.stringify(doc, null, 2) + "\n");
console.log("seeded", locales.map((l) => l.url).join(", "));
