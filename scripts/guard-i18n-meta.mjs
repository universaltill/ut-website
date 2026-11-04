#!/usr/bin/env node
// Key metadata guard for the website (ADR-0177 / ADR-0160 §2-§4, ut-docs#5405).
// Modelled on universal-till scripts/ci/guard-i18n-meta.sh. i18n/en.json is the
// English source for Weblate, i18n/en.meta.json the translator context.
//
// Fails when:
//   1. i18n/en.json differs from the en-gb block of site/i18n.js (missing key,
//      extra key or changed text; regenerate with scripts/extract-i18n.mjs);
//   2. a key has no entry, no non-empty `description` or no valid `review`
//      (legal | standard);
//   3. `placeholders` ("{name} — meaning", one per {name} token) does not
//      match the {name} tokens of the English text;
//   4. the meta names a key that is not in en.json;
//   5. a field is unknown, `max_length` is not a positive integer >= the
//      English length, or `html` disagrees with markup in the English text;
//   6. deny-by-default: a key or text that looks legal, privacy, terms,
//      cookie-consent or pricing is `standard` without a `review_exception`
//      reason (it must be `legal`, which needs a human reviewer to publish).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractEnglish, parseI18nSource } from "./extract-i18n.mjs";

export const LEGAL_KEY = /^(consent\.|foot\.(privacy|terms|impressum|cookies|owner|rights)$|wiz\.privacy$|wiz\.res\.sent$|wiz\.talk\.note$|wiz\.price\.|wiz\.hw\.need$|pluginspage\.(desc|intro|free|perm\.)|wiz\.gap\.(tr|fiscalother)$|wiz\.n\.(detse|ukfiscal|deowndevice)$|wiz\.r\.defiscal$|about\.body$)/;
export const LEGAL_TEXT = /(£|€|\$)\s?\d|\bprivacy\b|\bcookies?\b|\bGDPR\b|\bterms\b|\bTSE\b|\bfiscal\b|\bVAT\b|\bno (monthly )?fee\b|\bfree forever\b|\bcosts? (nothing|from)\b|\bnever take a cut\b|\bwe take no cut\b|\bMIT licen[cs]e\b|\bopen source under\b|per month|\bimpressum\b|\blegal\b|\bno minimum term\b|\bno tie-in\b|\bmeans free\b|\bfree\b|\bno cost\b|\bcharged\b|\blicensed\b|\bsends nothing\b|\bon Pro\b/i;

const FIELDS = new Set(["description", "review", "placeholders", "max_length", "html", "review_exception"]);
const tokens = (s) => [...s.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map((m) => m[1]);

export function checkMeta({ en, meta, source }) {
  const errors = [];
  const err = (m) => errors.push(m);

  for (const k of Object.keys(source)) {
    if (!(k in en)) err(`${k}: in the en-gb block of site/i18n.js but missing from en.json (run scripts/extract-i18n.mjs)`);
    else if (en[k] !== source[k]) err(`${k}: en.json text differs from the en-gb block of site/i18n.js (run scripts/extract-i18n.mjs)`);
  }
  for (const k of Object.keys(en)) if (!(k in source)) err(`${k}: in en.json but not in the en-gb block of site/i18n.js (run scripts/extract-i18n.mjs)`);

  for (const k of Object.keys(meta)) if (!(k in en)) err(`${k}: meta entry for a key that is not in en.json`);

  for (const [k, text] of Object.entries(en)) {
    const e = meta[k];
    if (!e || typeof e !== "object") { err(`${k}: no entry in en.meta.json`); continue; }
    if (typeof e.description !== "string" || !e.description.trim()) err(`${k}: missing description`);
    if (e.review !== "legal" && e.review !== "standard") err(`${k}: review must be "legal" or "standard"`);
    for (const f of Object.keys(e)) if (!FIELDS.has(f)) err(`${k}: unknown field "${f}"`);

    const want = [...new Set(tokens(text))].sort();
    const declared = Array.isArray(e.placeholders) ? e.placeholders : [];
    const got = declared.map((p) => (typeof p === "string" ? (p.match(/^\{([A-Za-z_][A-Za-z0-9_]*)\}\s+—\s+\S/) || [])[1] : undefined));
    if (got.some((g) => !g)) err(`${k}: each placeholders entry must read "{name} — meaning"`);
    const gotNames = got.filter(Boolean);
    if (new Set(gotNames).size !== gotNames.length) err(`${k}: placeholders lists a name twice`);
    const sorted = [...new Set(gotNames)].sort();
    for (const w of want) if (!sorted.includes(w)) err(`${k}: placeholder {${w}} is in the English text but not described in placeholders`);
    for (const g of sorted) if (!want.includes(g)) err(`${k}: placeholders describes {${g}} which is not in the English text`);
    if (e.placeholders !== undefined && !Array.isArray(e.placeholders)) err(`${k}: placeholders must be a list`);

    if (e.max_length !== undefined && (!Number.isInteger(e.max_length) || e.max_length <= 0 || e.max_length < text.length))
      err(`${k}: max_length must be a positive integer not shorter than the English text (${text.length})`);

    const hasMarkup = /<\/?[a-z][^>]*>/i.test(text);
    if (hasMarkup !== (e.html === true)) err(`${k}: html must be true exactly when the English text contains markup`);

    if (e.review === "standard" && (LEGAL_KEY.test(k) || LEGAL_TEXT.test(text)) && !(typeof e.review_exception === "string" && e.review_exception.trim()))
      err(`${k}: looks legal/privacy/terms/consent/pricing but is review "standard"; mark it "legal" or add a review_exception reason`);
    if (e.review_exception !== undefined && e.review !== "standard") err(`${k}: review_exception only applies to review "standard"`);
  }
  return errors;
}

function main() {
  const args = process.argv.slice(2);
  const ri = args.indexOf("--root");
  const root = ri >= 0 ? path.resolve(args[ri + 1]) : path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
  let en, meta, source;
  try {
    en = read("i18n/en.json");
    meta = read("i18n/en.meta.json");
    source = extractEnglish(parseI18nSource(fs.readFileSync(path.join(root, "site/i18n.js"), "utf8")));
  } catch (e) {
    console.error("guard-i18n-meta: " + e.message);
    process.exit(1);
  }
  const errors = checkMeta({ en, meta, source });
  for (const f of ["i18n/en.json", "i18n/en.meta.json"]) {
    const seen = new Set();
    for (const m of fs.readFileSync(path.join(root, f), "utf8").matchAll(/^ {2}("(?:[^"\\]|\\.)*"):/gm)) {
      if (seen.has(m[1])) errors.push(`${f}: duplicate key ${m[1]}`);
      seen.add(m[1]);
    }
  }
  if (errors.length) {
    console.error(errors.map((m) => "guard-i18n-meta: " + m).join("\n"));
    console.error(`guard-i18n-meta: FAILED (${errors.length} problem(s))`);
    process.exit(1);
  }
  const legal = Object.values(meta).filter((m) => m.review === "legal").length;
  console.log(`guard-i18n-meta: OK (${Object.keys(en).length} keys, ${legal} legal)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
