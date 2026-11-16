// node --test scripts/guard-help_test.mjs - the help guard against a tiny
// fixture dist/: one good tree, then one mutation per failure it must catch.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "guard-help-"));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
const O = "https://www.universaltill.com";
const LOCALES = ["en-gb", "de-de"];
let n = 0;

function page({ loc, rel, canonical, body = "" }) {
  return `<!DOCTYPE html><html><head><link rel="canonical" href="${canonical ?? O + rel}"></head><body><a href="/${loc}/help/">Help</a>${body}</body></html>`;
}

// de-de has the index and "a" translated; "b" is an English stand-in there.
function makeDist(mutate = () => {}) {
  const dist = fs.mkdtempSync(path.join(TMP, `d${n++}-`));
  const files = {};
  for (const loc of LOCALES) {
    files[`${loc}/help/index.html`] = page({ loc, rel: `/${loc}/help/`, body: `<a href="/${loc}/help/a/">a</a><a href="/${loc}/help/b/#sec">b</a>` });
    files[`${loc}/help/a/index.html`] = page({ loc, rel: `/${loc}/help/a/`, body: `<img src="/help-img/en/a.png"><h2 id="x">x</h2><a href="#x">x</a>` });
    const fb = loc === "de-de";
    files[`${loc}/help/b/index.html`] = page({ loc, rel: `/${loc}/help/b/`, canonical: fb ? `${O}/en-gb/help/b/` : undefined, body: `<h2 id="sec">s</h2>` });
  }
  files["help-img/en/a.png"] = "png";
  files["sitemap.xml"] = `<urlset>${[
    "/en-gb/help/", "/de-de/help/", "/en-gb/help/a/", "/de-de/help/a/", "/en-gb/help/b/",
  ].map((u) => `<url><loc>${O}${u}</loc></url>`).join("")}</urlset>`;
  mutate(files);
  for (const [rel, text] of Object.entries(files)) {
    if (text === null) continue;
    fs.mkdirSync(path.dirname(path.join(dist, rel)), { recursive: true });
    fs.writeFileSync(path.join(dist, rel), text);
  }
  return dist;
}

// The build's own manifest (what the build decided is public), not the allow-list.
const manifestFor = (m) => {
  const f = path.join(TMP, `manifest-${n++}.json`);
  fs.writeFileSync(f, JSON.stringify(m));
  return f;
};
const GOOD = () => ({
  ref: "fixture",
  topics: [
    { slug: "a", images: { "en-gb": "/help-img/en/a.png", "de-de": "/help-img/en/a.png" } },
    { slug: "b", images: {} },
  ],
});
function run(dist, manifest = GOOD(), extraEnv = {}) {
  return spawnSync(process.execPath, [path.join(here, "guard-help.mjs"), dist], {
    encoding: "utf8",
    env: { ...process.env, HELP_GUARD_MANIFEST: manifestFor(manifest), HELP_GUARD_MIN_TOPICS: "1", HELP_GUARD_LOCALES: LOCALES.join(","), ...extraEnv },
  });
}
const mustFail = (name, mutate, re) =>
  test(`fails: ${name}`, () => {
    const r = run(makeDist(mutate));
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, re);
  });

test("a good tree passes", () => {
  const r = run(makeDist());
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /guard-help: OK/);
});

test("fails: zero topics in the manifest, and fewer than the minimum", () => {
  let r = run(makeDist(), { ref: "x", topics: [] });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no public topics/);
  r = run(makeDist(), GOOD(), { HELP_GUARD_MIN_TOPICS: "5" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /at least 5/);
});
test("fails: a missing manifest", () => {
  const r = spawnSync(process.execPath, [path.join(here, "guard-help.mjs"), makeDist()], { encoding: "utf8", env: { ...process.env, HELP_GUARD_MANIFEST: path.join(TMP, "nope.json"), HELP_GUARD_LOCALES: "en-gb" } });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /manifest/);
});
test("fails: a topic that should show an image does not", () => {
  const dist = makeDist((f) => { f["en-gb/help/a/index.html"] = f["en-gb/help/a/index.html"].replace(/<img[^>]*>/, ""); });
  const r = run(dist);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /expected image \/help-img\/en\/a.png/);
});
mustFail("a locale lacks a topic", (f) => { f["de-de/help/b/index.html"] = null; }, /missing de-de\/help\/b\/index.html/);
mustFail("a topic missing from en-gb", (f) => { f["en-gb/help/a/index.html"] = null; }, /en-gb\/help\/a/);
mustFail("a dead internal link", (f) => { f["en-gb/help/index.html"] += '<a href="/en-gb/help/zzz/">z</a>'; }, /zzz/);
mustFail("a dead fragment", (f) => { f["en-gb/help/index.html"] += '<a href="/en-gb/help/b/#nope">z</a>'; }, /#nope/);
mustFail("a dead in-page anchor", (f) => { f["en-gb/help/a/index.html"] += '<a href="#nope">z</a>'; }, /in-page link #nope/);
mustFail("a referenced image that is missing", (f) => { f["help-img/en/a.png"] = null; }, /not in dist/);
mustFail("an orphan image", (f) => { f["help-img/en/orphan.png"] = "png"; }, /orphan image \/help-img\/en\/orphan.png/);
mustFail("front-matter keywords leaking", (f) => { f["en-gb/help/a/index.html"] += "<p>\nkeywords: [a, b]\n</p>"; }, /front-matter key/);
mustFail("title leaking", (f) => { f["en-gb/help/a/index.html"] += "<p>\ntitle: Selling\n</p>"; }, /front-matter key/);
mustFail("order leaking", (f) => { f["en-gb/help/a/index.html"] += "<p>\norder: 10\n</p>"; }, /front-matter key/);
mustFail("template braces", (f) => { f["en-gb/help/a/index.html"] += '<p>{{ helpLink "x" }}</p>'; }, /template braces/);
mustFail("a fallback page in the sitemap", (f) => { f["sitemap.xml"] = f["sitemap.xml"].replace("</urlset>", `<url><loc>${O}/de-de/help/b/</loc></url></urlset>`); }, /canonicalises to/);
mustFail("a real page missing from the sitemap", (f) => { f["sitemap.xml"] = f["sitemap.xml"].replace(`<url><loc>${O}/de-de/help/a/</loc></url>`, ""); }, /sitemap lacks .*de-de\/help\/a/);
mustFail("a page with no canonical", (f) => { f["en-gb/help/a/index.html"] = f["en-gb/help/a/index.html"].replace(/<link rel="canonical"[^>]*>/, ""); }, /no canonical/);
mustFail("a forbidden compliance claim in the text", (f) => { f["en-gb/help/a/index.html"] += "<p>Our till is GoBD-compliant.</p>"; }, /forbidden compliance claim "gobd-compliant"/);
