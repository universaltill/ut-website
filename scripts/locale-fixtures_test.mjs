// Fixture builds for the published-locale list (ADR-0177 section 6, ut-docs#5406).
// Two real `astro build`s into temp folders, each from a modified copy of the
// committed list:
//   A  the list gains ms-my and ar-sa (never written in code): both must appear
//      everywhere, with the AI label, fallback note, English-only legal pages,
//      rtl for ar, hreflang on the other locales, a switcher card, a sitemap line.
//   B  the list loses fa-ir (and a stray fa-ir/ar-sa string file is left behind):
//      no route, page, sitemap line, hreflang or switcher entry for it anywhere,
//      and a `withdrawn` fa-ir becomes a 301 rule and nothing else.
// Run: node --test scripts/locale-fixtures_test.mjs   (about 30 s)
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { check } from "./check-locale-consistency.mjs";
import { ROOT, buildSwaConfig, localeRoutes, legalApproved } from "./lib/locales.mjs";

const real = path.join(ROOT, "i18n");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ut-locale-fixture-"));
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));

function fixture(name, mutate) {
  const dir = path.join(tmp, name, "i18n");
  fs.cpSync(real, dir, { recursive: true });
  const listPath = path.join(dir, "published", "locales.json");
  const list = JSON.parse(fs.readFileSync(listPath, "utf8"));
  mutate(list, dir);
  fs.writeFileSync(listPath, JSON.stringify(list, null, 2));
  const out = path.join(tmp, name, "out");
  const r = spawnSync("npx", ["astro", "build"], { cwd: ROOT, env: { ...process.env, UT_I18N_DIR: dir, UT_OUT_DIR: out }, encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout.slice(-2000) + r.stderr.slice(-2000));
  return { dir, out, list };
}
const entry = (url, code, bcp47, dir, native, english, extra = {}) => ({
  code, weblate: code, url, bcp47, dir, english_name: english, native_name: native, published: true, reason: "",
  human_reviewed: false, machine_label: true, review_verified: false, legal_approved: false,
  surfaces: { website: { published: true, approved: 8, total: 465, core_ok: true, omitted_broken: 0, omitted_legal: 63, legal_approved: false } }, ...extra,
});
const read = (out, rel) => fs.readFileSync(path.join(out, rel), "utf8");
let A, B;

before(() => {
  A = fixture("a", (list, dir) => {
    list.locales.push(entry("ms-my", "ms", "ms-MY", "ltr", "Bahasa Melayu", "Malay"));
    list.locales.push(entry("ar-sa", "ar", "ar-SA", "rtl", "العربية", "Arabic"));
    const meta = JSON.parse(fs.readFileSync(path.join(dir, "en.meta.json"), "utf8"));
    const en = JSON.parse(fs.readFileSync(path.join(dir, "en.json"), "utf8"));
    // Only the core keys + a few others are "translated"; every other key falls back to English.
    for (const [url, tag] of [["ms-my", "ms"], ["ar-sa", "ar"]]) {
      const s = {};
      for (const k of Object.keys(meta).filter((x) => meta[x].core)) s[k] = `[${tag}] ${en[k]}`;
      s["nav.news"] = `[${tag}] News`; s["nav.language"] = `[${tag}] Language`;
      fs.writeFileSync(path.join(dir, `${url}.json`), JSON.stringify(s));
    }
  });
  B = fixture("b", (list, dir) => {
    list.locales = list.locales.filter((l) => l.url !== "fa-ir");
    fs.writeFileSync(path.join(dir, "ar-sa.json"), JSON.stringify({ "nav.news": "stray" })); // stray string, locale not in the list
  });
});

test("A: a new locale in the list appears everywhere, with no code change", () => {
  for (const [url, bcp, dir] of [["ms-my", "ms-MY", "ltr"], ["ar-sa", "ar-SA", "rtl"]]) {
    const home = read(A.out, `${url}/index.html`);
    assert.match(home, new RegExp(`<html lang="${bcp}" dir="${dir}">`));
    assert.equal((home.match(/data-mt-band/g) || []).length, 1, "one AI band");
    assert.match(home, /\[(ms|ar)\] Translated with AI/);
    assert.match(home, /data-fallback-note/, "fallback note");
    assert.match(home, /<span lang="en" dir="ltr" data-i18n-fallback(="")?>/, "English text is marked lang=en");
    assert.match(read(A.out, "en-gb/index.html"), new RegExp(`hreflang="${bcp}" href="https://www.universaltill.com/${url}"`));
    assert.match(read(A.out, "en-gb/language.html"), new RegExp(`data-code="${url}"`));
    assert.match(read(A.out, "sitemap.xml"), new RegExp(`/${url}/download</loc>`));
  }
  assert.deepEqual(check({ dist: A.out, listDir: A.dir, swa: false, content: false }), []);
  const routes = localeRoutes(A.list).map((r) => r.route);
  assert.ok(routes.includes("/ms-my/download") && routes.includes("/ar-sa") && routes.includes("/ar"));
});

test("A: legal pages of an unapproved locale are the English text, canonical to en-gb, outside hreflang", () => {
  const page = read(A.out, "ms-my/legal/privacy/index.html");
  assert.match(page, /data-legal-english/);
  assert.match(page, /\[ms\] This legal text is available in English only/);
  assert.match(page, /rel="canonical" href="https:\/\/www\.universaltill\.com\/en-gb\/legal\/privacy\/"/);
  assert.doesNotMatch(page, /rel="alternate" hreflang=/);
  assert.doesNotMatch(read(A.out, "sitemap.xml"), /ms-my\/legal/);
  assert.doesNotMatch(read(A.out, "en-gb/legal/privacy/index.html"), /hreflang="ms-MY"/);
});

test("A: nothing for an unrelated absent locale", () => {
  assert.deepEqual(check({ dist: A.out, listDir: A.dir, swa: false, content: false, absent: ["fr-fr", "it-it"] }), []);
});

test("B: a locale missing from the list leaves no trace in the build", () => {
  assert.equal(fs.existsSync(path.join(B.out, "fa-ir")), false);
  assert.equal(fs.existsSync(path.join(B.out, "ar-sa")), false);
  const errors = check({ dist: B.out, listDir: B.dir, swa: false, content: false, absent: ["fa-ir", "ar-sa"] });
  assert.deepEqual(errors, []);
  assert.doesNotMatch(read(B.out, "sitemap.xml"), /fa-ir|ar-sa/);
  assert.doesNotMatch(read(B.out, "en-gb/index.html"), /fa-IR|ar-SA/);
});

test("B: the content guard flags the leftover blog directory of the removed locale", () => {
  const errors = check({ dist: B.out, listDir: B.dir, swa: false, content: true });
  assert.ok(errors.some((e) => /src\/content\/blog\/fa-ir/.test(e)), errors.join("\n"));
});

test("B: the leak check catches a locale that is really in the build", () => {
  const errors = check({ dist: A.out, listDir: A.dir, swa: false, content: false, absent: ["ms-my"] });
  assert.ok(errors.some((e) => /leak/.test(e)));
  const bad = check({ dist: A.out, listDir: B.dir, swa: false, content: false });
  assert.ok(bad.some((e) => /not a published website locale/.test(e)), "a tree for a locale outside the list fails");
});

test("withdrawn: 301 to the same page in en-gb, nothing else; routes stay valid for the SWA guard", () => {
  const list = JSON.parse(JSON.stringify(B.list));
  list.withdrawn = [{ url: "fa-ir", surface: "website" }, { url: "ja-jp", surface: "cloud" }];
  const routes = localeRoutes(list);
  const fa = routes.filter((r) => r.route.startsWith("/fa-ir"));
  assert.ok(fa.length > 5);
  for (const r of fa) { assert.equal(r.statusCode, 301); assert.match(r.redirect, /^\/en-gb/); }
  assert.deepEqual(fa.find((r) => r.route === "/fa-ir/download"), { route: "/fa-ir/download", redirect: "/en-gb/download", statusCode: 301 });
  assert.equal(routes.some((r) => r.route.startsWith("/ja-jp")), false, "a withdrawn cloud locale is not a website rule");
  const cfg = buildSwaConfig({ routes: [{ route: "/", redirect: "/en-gb", statusCode: 301 }, { route: "/old/fa-ir", redirect: "/x" }], globalHeaders: { a: "b" } }, list);
  assert.deepEqual(cfg.globalHeaders, { a: "b" });
  assert.ok(cfg.routes.some((r) => r.route === "/"), "hand-kept entries survive");
  const dir = path.join(tmp, "swa"); fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, "c.json"), JSON.stringify(cfg));
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts", "check-swa-config.js"), path.join(dir, "c.json")], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
});

test("legalApproved: per-document flag wins, summary flag is the fallback, English source always", () => {
  const l = (legal, legal_approved) => ({ url: "xx-xx", surfaces: { website: { published: true, legal, legal_approved } } });
  assert.equal(legalApproved({ url: "en-gb" }, "privacy"), true);
  assert.equal(legalApproved(l({ privacy: true, terms: false }, false), "privacy"), true);
  assert.equal(legalApproved(l({ privacy: true, terms: false }, true), "terms"), false);
  assert.equal(legalApproved(l(undefined, true), "terms"), true);
  assert.equal(legalApproved(l(undefined, false), "terms"), false);
  assert.equal(legalApproved({ url: "xx-xx", surfaces: {} }, "terms"), false);
});
