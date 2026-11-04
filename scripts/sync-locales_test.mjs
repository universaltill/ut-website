// node --test scripts/sync-locales_test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncLocales } from "./sync-locales.mjs";
import { validate } from "./gen-locales.mjs";
import { loadDicts } from "./lib/locales.mjs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ut-sync-locales-"));
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));
const W = (p, v) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v)); };
const R = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const ent = (url, code, pub, extra = {}) => ({ code, weblate: code, url, english_name: url, native_name: url, dir: "ltr", published: pub, human_reviewed: false, machine_label: true, surfaces: pub ? { website: { published: true } } : {}, ...extra });

function setup(name, { cur, inc, incStrings = {}, curStrings = {}, withdrawn = [] }) {
  const base = path.join(tmp, name);
  const dir = path.join(base, "i18n"), from = path.join(base, "tr");
  W(path.join(dir, "en.json"), { a: "A", b: "B", c: "C" });
  W(path.join(dir, "published", "locales.json"), { schema: 1, locales: cur });
  for (const [u, s] of Object.entries(curStrings)) W(path.join(dir, `${u}.json`), s);
  W(path.join(from, "published", "locales.json"), { schema: 1, generated_at: "t", source_commit: "x", locales: inc, withdrawn });
  for (const [c, s] of Object.entries(incStrings)) W(path.join(from, "published", "website", `${c}.json`), s);
  return { dir, from };
}

test("a seeded live locale the upstream has not published is kept untouched", () => {
  const seed = ent("de-de", "de", true, { surfaces: { website: { published: true }, cloud: { manage: { published: true } } } });
  const { dir, from } = setup("seed", { cur: [ent("en-gb", "en", true), seed], inc: [ent("en-gb", "en", true), ent("de-de", "de", false)], curStrings: { "de-de": { a: "Ä" } } });
  syncLocales({ from, dir });
  const out = R(path.join(dir, "published", "locales.json"));
  assert.equal(out.locales.find((l) => l.url === "de-de").published, true);
  assert.deepEqual(R(path.join(dir, "de-de.json")), { a: "Ä" });
});

test("a newly published locale appears with its strings, English keys only", () => {
  const { dir, from } = setup("new", { cur: [ent("en-gb", "en", true)], inc: [ent("en-gb", "en", true), ent("fr-fr", "fr", true)], incStrings: { fr: { a: "Un", b: "", zzz: "x" } } });
  syncLocales({ from, dir });
  assert.deepEqual(R(path.join(dir, "fr-fr.json")), { a: "Un" });
  assert.ok(R(path.join(dir, "published", "locales.json")).locales.some((l) => l.url === "fr-fr" && l.published));
});

test("published strings win per key; keys the upstream omits keep the current text; cloud surfaces survive", () => {
  const seed = ent("tr-tr", "tr", true, { surfaces: { website: { published: true }, cloud: { manage: { published: true } } } });
  const { dir, from } = setup("overlay", { cur: [ent("en-gb", "en", true), seed], inc: [ent("en-gb", "en", true), ent("tr-tr", "tr", true)], curStrings: { "tr-tr": { a: "old", b: "keep" } }, incStrings: { tr: { a: "new", c: "yeni" } } });
  syncLocales({ from, dir });
  assert.deepEqual(R(path.join(dir, "tr-tr.json")), { a: "new", b: "keep", c: "yeni" });
  assert.equal(R(path.join(dir, "published", "locales.json")).locales.find((l) => l.url === "tr-tr").surfaces.cloud.manage.published, true);
});

test("a withdrawn locale is not kept as seed", () => {
  const { dir, from } = setup("withdrawn", { cur: [ent("en-gb", "en", true), ent("fa-ir", "fa", true)], inc: [ent("en-gb", "en", true), ent("fa-ir", "fa", false)], withdrawn: [{ surface: "website", url: "fa-ir" }] });
  syncLocales({ from, dir });
  assert.equal(R(path.join(dir, "published", "locales.json")).locales.find((l) => l.url === "fa-ir").published, false);
});

test("a withdrawn locale's strings file is removed so gen-locales still validates", () => {
  const { dir, from } = setup("withdrawn2", { cur: [ent("en-gb", "en", true), ent("fa-ir", "fa", true)], inc: [ent("en-gb", "en", true), ent("fa-ir", "fa", false)], withdrawn: [{ surface: "website", url: "fa-ir" }], curStrings: { "fa-ir": { a: "x" } } });
  fs.writeFileSync(path.join(dir, "en.meta.json"), "{}");
  syncLocales({ from, dir });
  assert.equal(fs.existsSync(path.join(dir, "fa-ir.json")), false);
  assert.deepEqual(validate(loadDicts(dir), dir), []);
});

test("published upstream but no strings file: not shown, seed kept if live", () => {
  const { dir, from } = setup("nofile", { cur: [ent("en-gb", "en", true), ent("tr-tr", "tr", true)], inc: [ent("en-gb", "en", true), ent("tr-tr", "tr", true), ent("fr-fr", "fr", true)], curStrings: { "tr-tr": { a: "x" } } });
  syncLocales({ from, dir });
  const l = R(path.join(dir, "published", "locales.json")).locales;
  assert.equal(l.find((e) => e.url === "tr-tr").published, true);
  assert.equal(l.find((e) => e.url === "fr-fr").surfaces.website.published, false);
});

test("human-reviewed locale: omitted keys do not fall back to seed text", () => {
  const { dir, from } = setup("human", { cur: [ent("en-gb", "en", true), ent("tr-tr", "tr", true)], inc: [ent("en-gb", "en", true), ent("tr-tr", "tr", true, { human_reviewed: true, machine_label: false })], curStrings: { "tr-tr": { a: "old", b: "old" } }, incStrings: { tr: { a: "new" } } });
  syncLocales({ from, dir });
  assert.deepEqual(R(path.join(dir, "tr-tr.json")), { a: "new" });
});

test("an unsafe upstream locale code is refused", () => {
  const { dir, from } = setup("unsafe", { cur: [ent("en-gb", "en", true)], inc: [ent("en-gb", "en", true), ent("../x", "fr", true)] });
  assert.throws(() => syncLocales({ from, dir }), /unsafe/);
});

test("the English source entry stays ours when upstream does not publish website for it", () => {
  const mine = ent("en-gb", "en", true, { english_name: "English (UK)" });
  const { dir, from } = setup("en", { cur: [mine], inc: [ent("en-gb", "en", false)] });
  syncLocales({ from, dir });
  assert.equal(R(path.join(dir, "published", "locales.json")).locales[0].english_name, "English (UK)");
});
