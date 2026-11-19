// Publish gate for the partner privacy notice page (ut-docs#6277 item 2).
// Two real `astro build`s into temp folders (like locale-fixtures_test.mjs):
//   OFF  the committed default: the page must not exist anywhere in the output.
//   ON   fixture build (UT_PARTNER_PRIVACY_PAGE=on + UT_OUT_DIR): the page exists,
//        is noindex, is linked/listed from nowhere, and its text is the draft.
// Run: node --test scripts/partner-privacy-gate_test.mjs   (about 1 minute)
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT } from "./lib/locales.mjs";
import { PARTNER_PRIVACY_PAGE_LIVE, PARTNER_PRIVACY_PATH, partnerPrivacyEnabled } from "../src/lib/partnerPrivacy.ts";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ut-partner-privacy-"));
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));

const TITLE = "Privacy notice for partners: support phone numbers";
const MDX = path.join(ROOT, "src/content/partner-notice/en-gb/partner-privacy.mdx");
const PAGE = "en-gb/partner-privacy/index.html";

// Section 1 of ut-docs reference/partner-support-contact-notices-draft.md, pinned
// word for word (markdown stripped). When the sibling ut-docs checkout is
// present the test also compares against the draft itself.
const DRAFT_TEXT = [
  "Support phone numbers partners publish. A support partner can publish a support phone number, the languages it supports and its opening hours in the Partner Portal. We (Task Runner Technology Ltd, trading as Universal Till) get the number from the partner company, or from you if you enter it yourself. We show the languages and opening hours to a shop that enters the partner's code, and we show the phone number only to shops that are connected to that partner, so they can get support. We do not show it anywhere else and we do not put it in emails or logs. Our legal basis is our legitimate interest in letting shops reach their support partner. If the number is a person's own mobile, it is that person's personal data, and the partner company should have told them before publishing it.",
  "We keep the number until the partner removes it, and delete it within 30 days after the partner's agreement with us ends. Backups roll off on our normal cycle. A shop that wrote the number down keeps its own copy; we cannot recall it.",
  "You can object. If your number is shown and you do not want it to be, you can object at any time. Write to support@universaltill.com and we will stop showing it while we look into it. You can also ask the partner company to remove it.",
  "You can ask us for a copy of your data, to correct it, or to delete it, and you can complain to us at the same address. You can also complain to the data protection regulator in your country.",
];

function build(name, env) {
  const out = path.join(tmp, name);
  const r = spawnSync("npx", ["astro", "build"], { cwd: ROOT, env: { ...process.env, UT_PARTNER_PRIVACY_PAGE: "", ...env, UT_OUT_DIR: out }, encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout.slice(-2000) + r.stderr.slice(-2000));
  return out;
}
function walk(dir, files = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    e.isDirectory() ? walk(p, files) : files.push(p);
  }
  return files;
}
const textFiles = (out) => walk(out).filter((f) => /\.(html|xml|txt|js|mjs|json|css)$/.test(f));
const grep = (out, re) => textFiles(out).filter((f) => re.test(fs.readFileSync(f, "utf8"))).map((f) => path.relative(out, f));
const read = (out, rel) => fs.readFileSync(path.join(out, rel), "utf8");
// the site's markdown smartypants curls apostrophes, hence the \u2019 replacement below
const plain = (html) => html.replace(/<\/?(strong|em|a|b|bdi|span|code)\b[^>]*>/g, "").replace(/<[^>]+>/g, " ").replace(/&#39;|&#x27;|\u2019/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

let OFF, ON;
before(() => {
  OFF = build("off", {});
  ON = build("on", { UT_PARTNER_PRIVACY_PAGE: "on" });
});

test("the page path is the one the partner app pins (and the committed flag is a boolean)", () => {
  assert.equal(typeof PARTNER_PRIVACY_PAGE_LIVE, "boolean");
  assert.equal(PARTNER_PRIVACY_PATH, "/partner-privacy/");
});

test("partnerPrivacyEnabled: env alone never switches the production build on", { skip: PARTNER_PRIVACY_PAGE_LIVE && "gate is LIVE: see the LIVE test" }, () => {
  const keep = { ...process.env };
  try {
    delete process.env.UT_OUT_DIR;
    process.env.UT_PARTNER_PRIVACY_PAGE = "on";
    assert.equal(partnerPrivacyEnabled(), false, "env on, no UT_OUT_DIR");
    process.env.UT_OUT_DIR = "/tmp/x";
    assert.equal(partnerPrivacyEnabled(), true, "env on + UT_OUT_DIR (fixture build)");
    process.env.UT_PARTNER_PRIVACY_PAGE = "yes";
    assert.equal(partnerPrivacyEnabled(), false, "only the exact value on");
    delete process.env.UT_PARTNER_PRIVACY_PAGE;
    assert.equal(partnerPrivacyEnabled(), false, "unset");
  } finally {
    for (const k of ["UT_OUT_DIR", "UT_PARTNER_PRIVACY_PAGE"]) keep[k] === undefined ? delete process.env[k] : (process.env[k] = keep[k]);
  }
});

test("OFF: the page is not emitted for any locale", { skip: PARTNER_PRIVACY_PAGE_LIVE && "gate is LIVE: see the LIVE test" }, () => {
  assert.equal(fs.existsSync(path.join(OFF, PAGE)), false);
  assert.equal(fs.existsSync(path.join(OFF, "de-de/partner-privacy")), false);
  assert.equal(walk(OFF).filter((f) => /partner-privacy/.test(path.relative(OFF, f))).length, 0, "no file named partner-privacy");
});

test("OFF: no output file (html, sitemap, llms, js, swa config) mentions the slug or the page text", { skip: PARTNER_PRIVACY_PAGE_LIVE && "gate is LIVE: see the LIVE test" }, () => {
  assert.deepEqual(grep(OFF, /partner-privacy/), []);
  assert.deepEqual(grep(OFF, /How we use this number|Privacy notice for partners/), []);
  assert.deepEqual(grep(OFF, /Support phone numbers partners publish/), []);
});

test("ON: page exists with noindex, one h1, self canonical, no form", () => {
  const html = read(ON, PAGE);
  assert.match(html, /<meta name="robots" content="noindex"/);
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1);
  assert.match(html, new RegExp(`<h1[^>]*>${TITLE}</h1>`));
  assert.match(html, /rel="canonical" href="https:\/\/www\.universaltill\.com\/en-gb\/partner-privacy\/"/);
  assert.doesNotMatch(html, /<form/);
  // Other locales are noindex English fallbacks (like legal/[slug]) so the header language picker never 404s.
  const de = read(ON, "de-de/partner-privacy/index.html");
  assert.match(de, /<meta name="robots" content="noindex"/);
  assert.match(de, /rel="canonical" href="https:\/\/www\.universaltill\.com\/en-gb\/partner-privacy\/"/);
  assert.match(de, /data-legal-english/);
  assert.doesNotMatch(de, /rel="alternate" hreflang/, "fallback pages advertise no alternates");
});

test("LIVE (committed flag true): the production-style build emits the page, noindex, listed nowhere", { skip: !PARTNER_PRIVACY_PAGE_LIVE && "gate is OFF" }, () => {
  const html = read(OFF, PAGE); // the default build; with the flag true it is the live build
  assert.match(html, /<meta name="robots" content="noindex"/);
  assert.doesNotMatch(html, /DRAFT/);
  for (const f of ["sitemap.xml", "llms.txt", "llms-full.txt"]) {
    if (fs.existsSync(path.join(OFF, f))) assert.doesNotMatch(read(OFF, f), /partner-privacy/, f);
  }
});

test("ON: still in no sitemap, llms file, app/legal route and no other page links to it", () => {
  for (const f of ["sitemap.xml", "llms.txt", "llms-full.txt"]) {
    if (fs.existsSync(path.join(ON, f))) assert.doesNotMatch(read(ON, f), /partner-privacy/, f);
  }
  assert.equal(fs.existsSync(path.join(ON, "en-gb/app/legal/partner-privacy")), false);
  const own = /^[a-z]{2}-[a-z]{2}[\\/]partner-privacy[\\/]index\.html$/;
  const linking = grep(ON, /partner-privacy/).filter((f) => !own.test(f));
  assert.deepEqual(linking, [], "only the page itself (any locale) may mention its own slug");
});

test("ON: body text is section 1 of the draft word for word; neutral regulator phrase; one address", () => {
  const html = read(ON, PAGE);
  const text = plain(html.slice(html.indexOf("<article"), html.indexOf("</article>")));
  let at = 0;
  for (const para of DRAFT_TEXT) {
    const i = text.indexOf(para, at);
    assert.ok(i >= at, `paragraph missing or reordered: ${para.slice(0, 50)}`);
    at = i + para.length;
  }
  assert.ok(text.includes("the data protection regulator in your country"));
  assert.doesNotMatch(text, /Information Commissioner|Commission/);
  assert.ok(text.includes("Task Runner Technology Ltd"));
  assert.deepEqual([...new Set(text.match(/[\w.+-]+@[\w.-]+/g))], ["support@universaltill.com"]);
  assert.doesNotMatch(text, /%/);
  assert.match(html, /href="mailto:support@universaltill\.com"/);
  assert.match(html, /href="\/en-gb\/support\/"/, "back link to support");
  assert.doesNotMatch(html, /<a [^>]*>(?:(?!<\/a>).)*<a /s, "no nested anchors");
  assert.equal((html.match(/href="mailto:support@universaltill\.com"/g) || []).length, 1, "one mailto link");
  assert.ok(text.includes("English"), "states English is the operative text");
});

test("the source mdx equals the ut-docs draft when the checkout is beside us, and carries the DRAFT marker while not live", () => {
  const src = fs.readFileSync(MDX, "utf8");
  // The marker is required only while the page is not live; the go-live PR removes it (see the flip guard below).
  if (!PARTNER_PRIVACY_PAGE_LIVE) assert.match(src, /(?:<!--|\{\/\*)\s*DRAFT\b/, "DRAFT marker comment (UX note); the go-live PR removes it");
  for (const dir of [process.env.UT_DOCS_DIR, path.join(ROOT, "../ut-docs"), path.join(ROOT, "../../../../ut-docs")].filter(Boolean)) {
    const f = path.join(dir, "reference/partner-support-contact-notices-draft.md");
    if (!fs.existsSync(f)) continue;
    const sec = fs.readFileSync(f, "utf8").split("## 1. ")[1].split("## 2. ")[0];
    const quoted = sec.split("\n").filter((l) => l.startsWith(">")).map((l) => l.replace(/^>\s?/, "")).join("\n")
      .split(/\n\s*\n/).map((p) => p.replace(/\*\*/g, "").replace(/\s+/g, " ").trim()).filter(Boolean);
    assert.deepEqual(quoted, DRAFT_TEXT, "pinned text drifted from the ut-docs draft");
    return;
  }
});

test("flag flip guard: a LIVE page may not still carry the DRAFT marker", () => {
  const src = fs.readFileSync(MDX, "utf8");
  if (PARTNER_PRIVACY_PAGE_LIVE) assert.doesNotMatch(src, /(?:<!--|\{\/\*)\s*DRAFT\b/, "remove the DRAFT marker in the flip PR");
});

test("nothing outside the new files changed: sitemap, llms, layout, SWA config do not know the page", () => {
  for (const f of ["src/pages/sitemap.xml.ts", "src/lib/llmsText.ts", "src/layouts/BaseLayout.astro", "site/staticwebapp.config.json"]) {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) assert.doesNotMatch(fs.readFileSync(p, "utf8"), /partner-privacy|partnerPrivacy/, f);
  }
});
