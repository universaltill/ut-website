// Self-test for scripts/guard-i18n-meta.mjs 
// (ADR-0177 slice 2, ut-docs#5405). Run: node --test scripts/guard-i18n-meta_test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { checkMeta } from "./guard-i18n-meta.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, "..");

const okEn = { "a.b": "Hello", "c.d": "Step {n} of {total}", "e.f": "Plain" };
const okMeta = () => ({
  "a.b": { description: "Greeting on the home page.", review: "standard" },
  "c.d": { description: "Progress.", review: "standard", placeholders: ["{n} — current step", "{total} — number of steps"] },
  "e.f": { description: "Something.", review: "standard" },
});
const run = (en, meta) => checkMeta({ en, meta });

test("clean fixture passes", () => assert.deepEqual(run(okEn, okMeta()), []));

test("key without description fails", () => {
  const m = okMeta(); delete m["a.b"].description;
  assert.match(run(okEn, m).join("\n"), /a\.b.*description/);
});
test("whitespace-only description fails", () => {
  const m = okMeta(); m["a.b"].description = "  ";
  assert.match(run(okEn, m).join("\n"), /a\.b.*description/);
});
test("key without meta entry fails", () => {
  const m = okMeta(); delete m["e.f"];
  assert.match(run(okEn, m).join("\n"), /e\.f.*no entry/);
});
test("missing or invalid review fails", () => {
  const m = okMeta(); delete m["a.b"].review; m["e.f"].review = "maybe";
  const out = run(okEn, m).join("\n");
  assert.match(out, /a\.b.*review/);
  assert.match(out, /e\.f.*review/);
});
test("meta for a key not in en.json fails", () => {
  const m = okMeta(); m["x.y"] = { description: "d", review: "standard" };
  assert.match(run(okEn, m).join("\n"), /x\.y.*not in en\.json/);
});
test("placeholder in text but not declared fails", () => {
  const m = okMeta(); delete m["c.d"].placeholders;
  assert.match(run(okEn, m).join("\n"), /c\.d.*\{n\}/);
});
test("declared placeholder not in text fails", () => {
  const m = okMeta(); m["a.b"].placeholders = ["{zzz} — nothing"];
  assert.match(run(okEn, m).join("\n"), /a\.b.*\{zzz\}/);
});
test("placeholder mismatch (renamed) fails", () => {
  const m = okMeta(); m["c.d"].placeholders = ["{n} — step", "{count} — steps"];
  assert.match(run(okEn, m).join("\n"), /c\.d/);
});
test("unknown field and bad max_length fail", () => {
  const m = okMeta(); m["a.b"].colour = "red"; m["e.f"].max_length = 2;
  const out = run(okEn, m).join("\n");
  assert.match(out, /a\.b.*unknown field/);
  assert.match(out, /e\.f.*max_length/);
});
test("html flag must match markup in the text", () => {
  const en = { ...okEn, "h.t": "Go <strong>now</strong>" };
  const m = okMeta(); m["h.t"] = { description: "d", review: "standard" };
  assert.match(run(en, m).join("\n"), /h\.t.*html/);
  m["h.t"].html = true;
  assert.deepEqual(run(en, m), []);
  m["a.b"].html = true;
  assert.match(run(en, m).join("\n"), /a\.b.*html/);
});
test("legal-looking key or text cannot be standard without review_exception", () => {
  const en = { "foot.privacy": "Privacy policy", "x.y": "Only £5 per month", "z.z": "Fine" };
  const m = {
    "foot.privacy": { description: "d", review: "standard" },
    "x.y": { description: "d", review: "standard" },
    "z.z": { description: "d", review: "standard" },
  };
  const out = run(en, m).join("\n");
  assert.match(out, /foot\.privacy.*legal/);
  assert.match(out, /x\.y.*legal/);
  assert.doesNotMatch(out, /z\.z/);
  m["foot.privacy"].review = "legal";
  m["x.y"].review_exception = "price shown by the page, not a claim";
  assert.deepEqual(run(en, m), []);
});

test("repo: en.json and en.meta.json pass the guard", () => {
  const r = spawnSync(process.execPath, [path.join(here, "guard-i18n-meta.mjs")], { encoding: "utf8", cwd: repo });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("CLI fails on a mutated copy of the repo files", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "i18n-guard-"));
  try {
    fs.mkdirSync(path.join(dir, "i18n"));
    const en = JSON.parse(fs.readFileSync(path.join(repo, "i18n/en.json"), "utf8"));
    const meta = JSON.parse(fs.readFileSync(path.join(repo, "i18n/en.meta.json"), "utf8"));
    delete meta["nav.news"].description;
    en["nav.home.extra"] = "x";
    fs.writeFileSync(path.join(dir, "i18n/en.json"), JSON.stringify(en));
    fs.writeFileSync(path.join(dir, "i18n/en.meta.json"), JSON.stringify(meta));
    const r = spawnSync(process.execPath, [path.join(here, "guard-i18n-meta.mjs"), "--root", dir], { encoding: "utf8" });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /nav\.news.*description/);
    assert.match(r.stderr, /nav\.home\.extra/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("every key the wizard can ask for is in en.json with metadata", () => {
  const ctx = {};
  for (const f of ["site/plan-prices.js", "site/wizard-rules.js"]) vm.runInNewContext(fs.readFileSync(path.join(repo, f), "utf8"), ctx);
  const en = JSON.parse(fs.readFileSync(path.join(repo, "i18n/en.json"), "utf8"));
  const meta = JSON.parse(fs.readFileSync(path.join(repo, "i18n/en.meta.json"), "utf8"));
  const keys = ctx.UT_WIZARD_RULES.allKeys();
  assert.ok(keys.length > 50);
  for (const k of keys) { assert.ok(k in en, `${k} missing from en.json`); assert.ok(meta[k]?.description, `${k} has no description`); }
});

test("every data-i18n key used by a page is in en.json", () => {
  const en = JSON.parse(fs.readFileSync(path.join(repo, "i18n/en.json"), "utf8"));
  const used = new Set();
  for (const f of fs.readdirSync(path.join(repo, "site")).filter((x) => x.endsWith(".html")))
    for (const m of fs.readFileSync(path.join(repo, "site", f), "utf8").matchAll(/data-i18n(?:-html|-aria-label|-alt|-content)?="([^"]+)"/g)) used.add(m[1]);
  assert.ok(used.size > 100);
  for (const k of used) assert.ok(k in en, `${k} used in site/*.html but missing from en.json`);
});

test("plain free/privacy/licence claims must be legal; review_exception rules", () => {
  const en = { "a.a": "It is free for the pilot", "b.b": "This page stores and sends nothing.", "c.c": "MIT licensed", "d.d": "Fine text" };
  const m = Object.fromEntries(Object.keys(en).map((k) => [k, { description: "d", review: "standard" }]));
  const out = run(en, m).join("\n");
  for (const k of ["a.a", "b.b", "c.c"]) assert.match(out, new RegExp(k.replace(".", "\\.") + ".*legal"));
  assert.doesNotMatch(out, /d\.d/);
  m["a.a"].review = "legal"; m["a.a"].review_exception = "x";
  assert.match(run(en, m).join("\n"), /a\.a.*review_exception only applies/);
});
test("placeholders must be a list and not repeat a name", () => {
  const m = okMeta(); m["c.d"].placeholders = "{n} — x";
  assert.match(run(okEn, m).join("\n"), /c\.d.*list/);
  const m2 = okMeta(); m2["c.d"].placeholders = ["{n} — a", "{n} — b", "{total} — c"];
  assert.match(run(okEn, m2).join("\n"), /c\.d.*twice/);
});
test("duplicate keys in the JSON files are caught by the CLI", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "i18n-dupe-"));
  try {
    fs.mkdirSync(path.join(dir, "i18n"));
    fs.copyFileSync(path.join(repo, "i18n/en.json"), path.join(dir, "i18n/en.json"));
    const raw = fs.readFileSync(path.join(repo, "i18n/en.meta.json"), "utf8");
    const line = raw.split("\n")[1];
    fs.writeFileSync(path.join(dir, "i18n/en.meta.json"), raw.replace(line, line.replace(/,?$/, ",") + "\n" + line));
    const r = spawnSync(process.execPath, [path.join(here, "guard-i18n-meta.mjs"), "--root", dir], { encoding: "utf8" });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /duplicate key/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// Classification pins (ut-docs#5405 follow-up): an unapproved legal-tier key is
// shown in English in every AI-only language (ADR-0160/0177), so plain
// marketing copy must stay standard and binding claims must stay legal.
test("real metadata: marketing copy is standard, binding claims are legal", () => {
  const meta = JSON.parse(fs.readFileSync(path.join(repo, "i18n/en.meta.json"), "utf8"));
  for (const k of ["foot.tagline", "hero.cta1", "close.cta", "close.title", "free.title", "nav.start", "wiz.cta.download", "wiz.price.pick"])
    assert.equal(meta[k].review, "standard", k);
  for (const k of ["wiz.privacy", "wiz.res.sent", "wiz.talk.note", "consent.text", "foot.privacy", "foot.terms", "foot.impressum", "wiz.price.month", "wiz.price.tse", "wiz.price.tsemin", "wiz.n.detse", "wiz.gap.tr", "wiz.q.card.hint", "why.exit.d", "pluginspage.perm.net", "free.body", "wiz.gap.team", "about.body", "hero.note"])
    assert.equal(meta[k].review, "legal", k);
});
test("real metadata: legal-tier count is pinned so re-classification shows in review", () => {
  const meta = JSON.parse(fs.readFileSync(path.join(repo, "i18n/en.meta.json"), "utf8"));
  // 64: + wiz.price.tsemin, the German managed-TSE minimum term (ut-docs#5473).
  assert.equal(Object.values(meta).filter((e) => e.review === "legal").length, 64);
});

test("core is only allowed on standard keys", () => {
  const m = okMeta(); m["a.b"].core = true;
  assert.deepEqual(run(okEn, m), []);
  m["a.b"].review = "legal";
  assert.match(run(okEn, m).join("\n"), /a\.b.*core/);
  const m2 = okMeta(); m2["a.b"].core = "yes";
  assert.match(run(okEn, m2).join("\n"), /a\.b.*core/);
});
test("the AI-label and fallback keys are core and standard", () => {
  const meta = JSON.parse(fs.readFileSync(path.join(repo, "i18n/en.meta.json"), "utf8"));
  for (const k of ["site.machine_label", "site.machine_label_detail", "site.machine_label_link", "site.machine_label_report", "site.machine_label_badge", "site.fallback_note", "site.legal_english_binding", "language.current"]) {
    assert.equal(meta[k].core, true, k); assert.equal(meta[k].review, "standard", k);
  }
});
