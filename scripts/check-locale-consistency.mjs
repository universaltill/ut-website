#!/usr/bin/env node
// Fails when what the BUILT site serves disagrees with the published-locale
// list (ADR-0177 section 6, ut-docs#5406). The list is the only authority:
//
//   routes     site/staticwebapp.config.json == what gen-locales.mjs makes
//   pages      every published locale has every marketing page, <html lang dir>
//              from the list; no other /xx-yy/ tree exists in dist/
//   sitemap    only published locales, every marketing page of each
//   hreflang   every indexable marketing page lists exactly the published set
//              + x-default (en-gb)
//   switcher   /language lists exactly the published locales, in list order,
//              badge on machine-labelled ones only, one aria-current
//   my. link   data-my-link points at the page locale iff cloud.manage serves it
//   content    src/content/<collection>/ holds no directory for an unpublished locale
//   leak       with --absent a,b: no route, sitemap, hreflang or switcher entry
//              for those codes anywhere in dist/ (only the withdrawn 301 rule
//              may name a locale in site/staticwebapp.config.json)
//
//   node scripts/check-locale-consistency.mjs [--dist dist] [--list-dir i18n] [--absent ar-sa] [--no-swa] [--no-content]
import fs from "node:fs";
import path from "node:path";
import { ROOT, PAGES, buildSwaConfig, hasMachineLabel, loadList, myLocales, serializeSwa, websiteLocales, withdrawnUrls, bcp47Of } from "./lib/locales.mjs";

export function check({ dist, listDir, absent = [], swa = true, content = true }) {
  const errors = [];
  const err = (m) => errors.push(m);
  const list = loadList(listDir);
  const locales = websiteLocales(list);
  const urls = locales.map((l) => l.url);
  const my = myLocales(list);
  const read = (rel) => (fs.existsSync(path.join(dist, rel)) ? fs.readFileSync(path.join(dist, rel), "utf8") : null);

  if (swa) {
    const swaPath = path.join(ROOT, "site", "staticwebapp.config.json");
    const have = fs.readFileSync(swaPath, "utf8");
    const want = serializeSwa(buildSwaConfig(JSON.parse(have), list));
    if (have !== want) err("site/staticwebapp.config.json differs from the routes the published list implies (run node scripts/gen-locales.mjs)");
  }

  // pages
  const trees = fs.readdirSync(dist, { withFileTypes: true }).filter((d) => d.isDirectory() && /^[a-z]{2}-[a-z]{2}$/.test(d.name)).map((d) => d.name);
  for (const t of trees) if (!urls.includes(t)) err(`dist/${t}/ exists but ${t} is not a published website locale`);
  for (const l of locales) {
    for (const p of PAGES) {
      const html = read(`${l.url}/${p.file}`);
      if (html == null) { err(`dist/${l.url}/${p.file} is missing`); continue; }
      const m = html.match(/<html\b[^>]*>/i)?.[0] ?? "";
      if (!m.includes(`lang="${bcp47Of(l)}"`)) err(`${l.url}/${p.file}: <html> lacks lang="${bcp47Of(l)}"`);
      if (!m.includes(`dir="${l.dir}"`)) err(`${l.url}/${p.file}: <html> lacks dir="${l.dir}"`);
      const band = (html.match(/data-mt-band/g) || []).length;
      if (band !== (hasMachineLabel(l) ? 1 : 0)) err(`${l.url}/${p.file}: expected ${hasMachineLabel(l) ? 1 : 0} AI band, found ${band}`);
      // hreflang
      if (!/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html)) {
        const got = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map((x) => `${x[1]} ${x[2]}`).sort();
        const want = [...locales.map((x) => `${bcp47Of(x)} https://www.universaltill.com/${x.url}${p.suffix}`), `x-default https://www.universaltill.com/en-gb${p.suffix}`].sort();
        if (JSON.stringify(got) !== JSON.stringify(want)) err(`${l.url}/${p.file}: hreflang set differs from the published list`);
        if (!html.includes(`<link rel="canonical" id="canonical" href="https://www.universaltill.com/${l.url}${p.suffix}">`)) err(`${l.url}/${p.file}: canonical is not self-referencing`);
      }
      // my. link
      for (const a of html.matchAll(/<a\b[^>]*data-my-link[^>]*>/g)) {
        const href = a[0].match(/href="([^"]+)"/)?.[1];
        const want = `https://my.universaltill.com/${my.has(l.url) ? l.url : "en-gb"}/`;
        if (href !== want) err(`${l.url}/${p.file}: my. link ${href} should be ${want}`);
      }
    }
    // switcher
    const lang = read(`${l.url}/language.html`) ?? "";
    const cards = [...lang.matchAll(/<a class="locale-card[^"]*" href="[^"]*" hreflang="[^"]*" data-code="([^"]+)"([^>]*)>(.*?)<\/a>/g)];
    if (JSON.stringify(cards.map((c) => c[1])) !== JSON.stringify(urls)) err(`${l.url}/language.html: switcher lists [${cards.map((c) => c[1])}] but the published list is [${urls}]`);
    if (cards.filter((c) => c[2].includes('aria-current="true"')).length !== 1) err(`${l.url}/language.html: expected exactly one aria-current card`);
    for (const c of cards) {
      const target = locales.find((x) => x.url === c[1]);
      if (target && c[3].includes("mt-badge") !== hasMachineLabel(target)) err(`${l.url}/language.html: AI badge on ${c[1]} disagrees with the list`);
    }
  }

  // sitemap
  const sm = read("sitemap.xml") ?? "";
  const locs = [...sm.matchAll(/<loc>https:\/\/www\.universaltill\.com\/([^<]*)<\/loc>/g)].map((m) => m[1]);
  for (const loc of locs) {
    const first = loc.split("/")[0];
    if (/^[a-z]{2}-[a-z]{2}$/.test(first) && !urls.includes(first)) err(`sitemap.xml lists ${loc} but ${first} is not published`);
  }
  for (const l of locales) for (const p of PAGES) {
    const html = read(`${l.url}/${p.file}`) ?? "";
    if (/noindex/.test(html.match(/<meta\s+name="robots"[^>]*>/i)?.[0] ?? "")) continue;
    if (!locs.includes(`${l.url}${p.suffix}`)) err(`sitemap.xml lacks /${l.url}${p.suffix}`);
  }

  // content directories
  if (content) for (const col of ["blog", "legal"]) {
    const dir = path.join(ROOT, "src", "content", col);
    if (!fs.existsSync(dir)) continue;
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) if (d.isDirectory() && !urls.includes(d.name)) err(`src/content/${col}/${d.name}/ is a directory for a locale that is not published`);
  }

  // leak scan
  const swaText = fs.readFileSync(path.join(ROOT, "site", "staticwebapp.config.json"), "utf8");
  for (const a of absent) {
    if (withdrawnUrls(list).includes(a)) continue;
    if (fs.existsSync(path.join(dist, a))) err(`leak: dist/${a}/ exists`);
    const needle = new RegExp(`(/${a}(?![a-z0-9-])|hreflang="${a.replace(/-([a-z]+)$/, (_, r) => "-" + r.toUpperCase())}"|data-code="${a}")`, "i");
    for (const rel of fs.readdirSync(dist, { recursive: true })) {
      if (!/\.(html|xml|txt|js|json)$/.test(rel) || rel === "staticwebapp.config.json") continue; // routes: checked against the list above
      const text = fs.readFileSync(path.join(dist, rel), "utf8");
      if (needle.test(text)) { err(`leak: ${rel} mentions the absent locale ${a}`); break; }
    }
    if (swa && new RegExp(`"/${a}[/"]`).test(swaText)) err(`leak: site/staticwebapp.config.json has a route for the absent locale ${a}`);
  }
  return errors;
}

function main() {
  const a = process.argv.slice(2);
  const val = (f, d) => (a.includes(f) ? a[a.indexOf(f) + 1] : d);
  const errors = check({
    dist: path.resolve(val("--dist", path.join(ROOT, "dist"))),
    listDir: path.resolve(val("--list-dir", path.join(ROOT, "i18n"))),
    absent: val("--absent", "").split(",").filter(Boolean),
    swa: !a.includes("--no-swa"),
    content: !a.includes("--no-content"),
  });
  if (errors.length) { console.error(errors.map((e) => "check-locale-consistency: " + e).join("\n")); console.error(`check-locale-consistency: FAILED (${errors.length})`); process.exit(1); }
  console.log("check-locale-consistency: OK");
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
