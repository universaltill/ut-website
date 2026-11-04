#!/usr/bin/env node
// ADR-0177 slice 2 (ut-docs#5405): mechanically extracts the English source
// strings for Weblate from the en-gb block of site/i18n.js into i18n/en.json
// (flat key -> text, source order, `_name`/`_english`/`_dir` locale metadata
// dropped). site/i18n.js stays the runtime source until the slice 4 cutover;
// this file is derived, never hand-edited. Metadata lives in i18n/en.meta.json.
//
//   node scripts/extract-i18n.mjs            write i18n/en.json
//   node scripts/extract-i18n.mjs --check    exit 1 if i18n/en.json is stale
//   --root <dir>                             repo root (tests)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function parseI18nSource(src) {
  const m = src.match(/const I18N = (\{[\s\S]*?\});\s*\n\s*\(function/);
  if (!m) throw new Error("could not locate the I18N object literal in site/i18n.js");
  return (0, eval)("(" + m[1] + ")");
}

export function extractEnglish(I18N) {
  const en = I18N["en-gb"];
  if (!en) throw new Error("no en-gb block in the I18N object");
  return Object.fromEntries(Object.entries(en).filter(([k]) => !k.startsWith("_")));
}

export function serialize(en) {
  return "{\n" + Object.entries(en).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n") + "\n}\n";
}

function main() {
  const args = process.argv.slice(2);
  const ri = args.indexOf("--root");
  const root = ri >= 0 ? path.resolve(args[ri + 1]) : path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const check = args.includes("--check");
  const out = path.join(root, "i18n", "en.json");
  const want = serialize(extractEnglish(parseI18nSource(fs.readFileSync(path.join(root, "site", "i18n.js"), "utf8"))));
  if (check) {
    const have = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : null;
    if (have !== want) {
      console.error("extract-i18n: i18n/en.json is out of date with the en-gb block of site/i18n.js; run: node scripts/extract-i18n.mjs");
      process.exit(1);
    }
    console.log("extract-i18n: i18n/en.json is up to date");
    return;
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, want);
  console.log(`extract-i18n: wrote ${out} (${want.split("\n").length - 3} keys)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
