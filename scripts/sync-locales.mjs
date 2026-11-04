#!/usr/bin/env node
// Pulls the published locales for the website surface from a checkout of
// ut-translations@main (ADR-0177 section 3; ut-docs#5545, part of #5405):
//
//   <from>/published/locales.json          -> i18n/published/locales.json
//   <from>/published/website/<weblate>.json -> i18n/<url-locale>.json
//
//   node scripts/sync-locales.mjs --from <ut-translations checkout>
//
// Never regresses a live page. A locale this repo already publishes (the
// seed from the old hand dictionaries, ut-docs#5406) but ut-translations does
// not yet publish for `website` keeps its list entry and its strings until
// ut-translations publishes it. For a locale ut-translations does publish,
// the approved strings overlay the ones already here (published wins per key;
// a key absent from the incoming file keeps its current text); keys that are
// not English keys any more are dropped. The cloud.* surfaces of an entry,
// which this repo does not own, are kept when the incoming entry has none.
// The output is then checked by scripts/gen-locales.mjs (CI), which refuses
// unsafe values.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SOURCE, SURFACE } from "./lib/locales.mjs";

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const writeJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
const publishedForWebsite = (l) => l.url === SOURCE || (l.surfaces && l.surfaces[SURFACE] && l.surfaces[SURFACE].published === true);
const upstreamPublishes = (l) => !!(l.surfaces && l.surfaces[SURFACE] && l.surfaces[SURFACE].published === true);
const URL_RE = /^[a-z]{2}-[a-z]{2}$/;
const CODE_RE = /^[A-Za-z_]+$/;

export function syncLocales({ from, dir }) {
  const incoming = readJson(path.join(from, "published", "locales.json"));
  if (incoming.schema !== 1 || !Array.isArray(incoming.locales)) throw new Error("incoming published/locales.json: expected schema 1 with a locales array");
  const curPath = path.join(dir, "published", "locales.json");
  const current = fs.existsSync(curPath) ? readJson(curPath) : { locales: [] };
  const english = readJson(path.join(dir, "en.json"));
  const byUrl = new Map(current.locales.map((l) => [l.url, l]));
  const withdrawn = new Set((incoming.withdrawn || []).filter((w) => w.surface === SURFACE).map((w) => w.url));

  const locales = [];
  const report = [];
  for (const inc of incoming.locales) {
    if (!URL_RE.test(inc.url) || !CODE_RE.test(String(inc.weblate || inc.code))) throw new Error(`incoming list: unsafe locale ${JSON.stringify(inc.url)} / ${JSON.stringify(inc.weblate || inc.code)}`);
    const cur = byUrl.get(inc.url);
    byUrl.delete(inc.url);
    const src = path.join(from, "published", SURFACE, `${inc.weblate || inc.code}.json`);
    const live = cur && publishedForWebsite(cur) && !withdrawn.has(inc.url);
    // The English source stays ours unless upstream publishes `website` for it.
    const takeUpstream = inc.url === SOURCE ? upstreamPublishes(inc) : upstreamPublishes(inc) && fs.existsSync(src);
    if (!takeUpstream) {
      if (live) { locales.push(cur); report.push(`${inc.url}: kept (seed, not published upstream yet)`); continue; }
      const unpub = inc.url === SOURCE ? inc : { ...inc, published: false, surfaces: { ...(inc.surfaces || {}), [SURFACE]: { ...((inc.surfaces || {})[SURFACE] || {}), published: false } } };
      locales.push(unpub);
      if (upstreamPublishes(inc) && !fs.existsSync(src)) report.push(`${inc.url}: upstream says published but has no strings file; not shown`);
      continue;
    }
    let entry = inc;
    if (cur && cur.surfaces && cur.surfaces.cloud && !(inc.surfaces && inc.surfaces.cloud)) entry = { ...inc, surfaces: { ...inc.surfaces, cloud: cur.surfaces.cloud } };
    locales.push(entry);
    if (inc.url === SOURCE) continue;
    const file = path.join(dir, `${inc.url}.json`);
    const strings = fs.existsSync(file) ? readJson(file) : {};
    const incomingStrings = readJson(src);
    // Seed text fills the keys upstream omits only while the locale still carries the AI label.
    const keepSeed = entry.machine_label !== false && entry.human_reviewed !== true;
    const merged = {};
    for (const k of Object.keys(english)) {
      const v = k in incomingStrings ? incomingStrings[k] : keepSeed ? strings[k] : undefined;
      if (typeof v === "string" && v !== "") merged[k] = v;
    }
    writeJson(file, merged);
    report.push(`${inc.url}: ${Object.keys(merged).length} strings (${Object.keys(incomingStrings).length} incoming)`);
  }
  // A locale only this repo knows: keep it if it is live (seed), nothing else.
  for (const cur of byUrl.values()) if (publishedForWebsite(cur) && !withdrawn.has(cur.url)) { locales.push(cur); report.push(`${cur.url}: kept (seed, unknown upstream)`); }

  // A strings file for a locale the list does not serve would fail gen-locales for every later sync.
  const served = new Set(locales.filter(publishedForWebsite).map((l) => l.url));
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^([a-z]{2}-[a-z]{2})\.json$/);
    if (m && !served.has(m[1]) && m[1] !== SOURCE) { fs.unlinkSync(path.join(dir, f)); report.push(`${m[1]}: strings file removed (locale not served)`); }
  }

  fs.mkdirSync(path.dirname(curPath), { recursive: true });
  writeJson(curPath, { schema: 1, generated_at: incoming.generated_at, source_commit: incoming.source_commit, locales, withdrawn: incoming.withdrawn || [] });
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf("--from");
  if (i < 0) { console.error("usage: sync-locales.mjs --from <ut-translations checkout>"); process.exit(2); }
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  for (const line of syncLocales({ from: path.resolve(process.argv[i + 1]), dir: path.join(root, "i18n") })) console.log(line);
}
