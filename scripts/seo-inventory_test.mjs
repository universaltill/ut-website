// Unit tests for the SEO site inventory (ut-docs#6887, ADR-0211 section 3).
// Each test builds a throwaway dist/ in a temp folder; nothing is checked in.
// Run: node --test scripts/seo-inventory_test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveRequest } from "./lib/swa-routes.mjs";
import {
  parseSitemapLocs, kindOf, isInternal, extractPage, validateKeywordMap, declaredOwners,
  buildInventory, serializeInventory,
} from "./lib/seo-inventory.mjs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ut-seo-inv-"));
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));
let n = 0;
const HOST = "https://www.universaltill.com";

const page = ({ title = "Title", desc = "Desc", canonical = "/en-gb", head = "", main = "<main><h1>Hello</h1><p>Body text.</p></main>", footer = "<footer>Foot A</footer>", extra = "" } = {}) =>
  `<!doctype html><html lang="en"><head><title>${title}</title><meta name="description" content="${desc}"><link rel="canonical" href="${HOST}${canonical}"><link rel="alternate" hreflang="de-DE" href="${HOST}/de-de"><link rel="alternate" hreflang="en-GB" href="${HOST}/en-gb">${head}</head><body><nav><a href="/en-gb/download">Get</a></nav>${main}${footer}${extra}</body></html>`;

const entry = (url, bcp47, dir, human = false) => ({ url, bcp47, dir, human_reviewed: human, english_name: url, surfaces: { website: { published: true } } });
const LIST = { schema: 1, locales: [entry("de-de", "de-DE", "ltr", true), entry("en-gb", "en-GB", "ltr")] };

/** files: { "rel/path": html }, routes: swa routes, locs: sitemap paths */
function fixture({ files, routes, locs, sitemap }) {
  const dist = path.join(tmp, `d${n++}`);
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dist, rel)), { recursive: true });
    fs.writeFileSync(path.join(dist, rel), body);
  }
  const xml = sitemap ?? `<?xml version="1.0"?><urlset>${locs.map((l) => `<url><loc>${l}</loc></url>`).join("")}</urlset>`;
  fs.mkdirSync(dist, { recursive: true });
  fs.writeFileSync(path.join(dist, "sitemap.xml"), xml);
  return { distDir: dist, config: { routes } };
}
const std = () => fixture({
  files: { "en-gb/index.html": page(), "de-de/index.html": page({ canonical: "/de-de", main: '<main><h1>Hallo</h1><p lang="en">English bit</p><p>Text</p></main>' }), "en-gb/blog/index.html": page({ canonical: "/en-gb/blog/" }) },
  routes: [{ route: "/en-gb", rewrite: "/en-gb/index.html" }, { route: "/de-de", rewrite: "/de-de/index.html" }, { route: "/en-gb/old", redirect: "/en-gb", statusCode: 301 }],
  locs: [`${HOST}/en-gb`, `${HOST}/de-de`, `${HOST}/en-gb/blog/`],
});
const run = (fx, over = {}) => buildInventory({ ...fx, list: LIST, map: null, env: { GITHUB_SHA: "abc", GITHUB_RUN_ID: "7" }, now: new Date("2030-01-02T03:04:05.678Z"), ...over });

test("resolveRequest: rewrite, directory index, redirect, missing, traversal", () => {
  const fx = fixture({ files: { "en-gb/index.html": "x", "en-gb/blog/index.html": "y" }, routes: [{ route: "/en-gb", rewrite: "/en-gb/index.html" }, { route: "/gone", redirect: "/en-gb", statusCode: 301 }, { route: "/r2", redirect: "/en-gb" }], locs: [] });
  const r = (p) => resolveRequest(fx.distDir, fx.config, p);
  assert.equal(r("/en-gb").filePath, path.join(fx.distDir, "en-gb/index.html"));
  assert.equal(r("/en-gb/").filePath, path.join(fx.distDir, "en-gb/index.html"));
  assert.equal(r("/en-gb/blog/").filePath, path.join(fx.distDir, "en-gb/blog/index.html"));
  assert.deepEqual(r("/gone").redirect, { status: 301, location: "/en-gb" });
  assert.equal(r("/gone").filePath, null);
  assert.equal(r("/r2").redirect.status, 302);
  assert.equal(r("/nope").filePath, null);
  assert.equal(r("/../../etc/passwd").forbidden, true);
});

test("kindOf: six kinds", () => {
  assert.equal(kindOf("/blog/x/"), "blog");
  assert.equal(kindOf("/legal/privacy/"), "legal");
  assert.equal(kindOf("/help/x/"), "help");
  assert.equal(kindOf("/plugins/x/"), "plugin");
  assert.equal(kindOf("/claude/x/"), "connector");
  assert.equal(kindOf("/download"), "marketing");
  assert.equal(kindOf(""), "marketing");
});

test("isInternal: exact hosts only", () => {
  const yes = ["/en-gb/download", "https://www.universaltill.com/x", "https://universaltill.com/x", "https://WWW.UniversalTill.com/x", "http://universaltill.com/"];
  const no = ["https://universaltill.community/", "https://universaltill.com.evil.example/", "https://evil.example/universaltill.com", "https://my.universaltill.com/", "https://cms.universaltill.com/", "https://evil-universaltill.com/", "https://universaltill.com.evil.net/", "ftp://www.universaltill.com/x", "ws://www.universaltill.com/x", "https://user:pw@www.universaltill.com/", "http://universaltill.com:8080/", "https://www.universaltill.com:8443/", "https://user@www.universaltill.com/", "mailto:a@www.universaltill.com", "tel:+1"];
  for (const u of yes) assert.equal(isInternal(new URL(u, HOST + "/en-gb")), true, u);
  for (const u of no) assert.equal(isInternal(new URL(u, HOST + "/en-gb")), false, u);
});

test("extractPage: head fields, headings, links, bodyText excludes chrome/script/svg/hidden", () => {
  const html = page({ head: '<meta name="ROBOTS" content="NoIndex, follow">', main: '<main><h1>One  <b>Two</b></h1><h2>Sub</h2><h4>Skip</h4><p>Para<br>Next</p><script>var x=1</script><style>.a{}</style><svg><text>SVG</text></svg><div hidden>Hidden</div><a href="https://evil.example/x" rel="nofollow">Out</a><a href="#top">anchor</a><a href="javascript:void(0)">js</a><a href="mailto:a@b.example">Mail</a></main>' });
  const r = extractPage(html, { pageUrl: HOST + "/en-gb", isSource: true });
  assert.equal(r.title, "Title"); assert.equal(r.description, "Desc"); assert.equal(r.canonical, HOST + "/en-gb");
  assert.equal(r.noindex, true);
  assert.deepEqual(r.hreflang[0], { hreflang: "de-DE", href: HOST + "/de-de" });
  assert.deepEqual(r.headings, [{ level: 1, text: "One Two" }, { level: 2, text: "Sub" }]);
  assert.equal(r.bodyText, "One Two Sub Skip Para Next OutanchorjsMail");
  for (const bad of ["SVG", "Hidden", "var x", ".a{}"]) assert.ok(!r.bodyText.includes(bad), bad);
  assert.deepEqual(r.links.map((l) => [l.href, l.area, l.internal, l.rel]), [
    ["/en-gb/download".replace(/^/, HOST), "chrome", true, null],
    ["https://evil.example/x", "body", false, "nofollow"],
    ["mailto:a@b.example", "body", false, null],
  ]);
});

test("extractPage: changing the footer does not change bodyText; missing title/desc are null", () => {
  const a = extractPage(page({ footer: "<footer>A</footer>" }), { pageUrl: HOST + "/en-gb", isSource: true });
  const b = extractPage(page({ footer: "<footer>Completely different</footer>" }), { pageUrl: HOST + "/en-gb", isSource: true });
  assert.equal(a.bodyText, b.bodyText);
  const c = extractPage("<html><head></head><body><main><p>x</p></main></body></html>", { pageUrl: HOST + "/en-gb", isSource: true });
  assert.equal(c.title, null); assert.equal(c.description, null); assert.equal(c.canonical, null); assert.equal(c.noindex, false);
});

test("extractPage: no main / multiple main", () => {
  const none = extractPage("<html><body><p>x</p><a href='/a'>a</a></body></html>", { pageUrl: HOST + "/en-gb", isSource: true });
  assert.equal(none.problem, "no_main"); assert.equal(none.bodyText, null); assert.deepEqual(none.headings, []); assert.equal(none.translated, null); assert.equal(none.links[0].area, "chrome");
  const two = extractPage("<html><body><main>a</main><main>b</main></body></html>", { pageUrl: HOST + "/en-gb", isSource: true });
  assert.equal(two.problem, "multiple_main"); assert.equal(two.bodyText, null);
});

test("extractPage: translated / fallbackElements", () => {
  const main = '<main lang="en"><p lang="en-GB">a</p><p data-i18n-fallback>b</p><p lang="de">c</p></main>';
  const t = extractPage(page({ main }), { pageUrl: HOST + "/de-de", isSource: false });
  assert.equal(t.fallbackElements, 2); assert.equal(t.translated, false);
  const s = extractPage(page({ main }), { pageUrl: HOST + "/en-gb", isSource: true });
  assert.equal(s.fallbackElements, 0); assert.equal(s.translated, true);
  const ok = extractPage(page({ main: "<main><p>x</p></main>" }), { pageUrl: HOST + "/de-de", isSource: false });
  assert.equal(ok.translated, true);
});

test("parseSitemapLocs decodes entities", () => {
  assert.deepEqual(parseSitemapLocs("<loc>https://a/x?a=1&amp;b=2</loc><loc>https://a/y</loc>"), ["https://a/x?a=1&b=2", "https://a/y"]);
});

test("buildInventory: rows, header, locales, translated, redirect row path", () => {
  const inv = run(std());
  assert.equal(inv.schemaVersion, "1.0"); assert.equal(inv.buildSha, "abc"); assert.equal(inv.deployRunId, "7");
  assert.equal(inv.computedAt, "2030-01-02T03:04:05Z");
  assert.deepEqual(inv.rows.map((r) => r.path), ["/de-de", "/en-gb", "/en-gb/blog/"]);
  assert.deepEqual(inv.locales, [{ code: "en-gb", bcp47: "en-GB", dir: "ltr", humanReviewed: false }, { code: "de-de", bcp47: "de-DE", dir: "ltr", humanReviewed: true }]);
  const de = inv.rows[0];
  assert.equal(de.locale, "de-de"); assert.equal(de.translated, false); assert.equal(de.fallbackElements, 1);
  assert.equal(inv.rows[2].kind, "blog");
  assert.deepEqual(Object.keys(inv), ["schemaVersion", "buildSha", "deployRunId", "computedAt", "contentSha256", "locales", "problems", "declaredOwners", "indexNow", "rows"]);
  assert.deepEqual(Object.keys(de), ["path", "locale", "kind", "noindex", "title", "description", "canonical", "hreflang", "headings", "bodyText", "links", "translated", "fallbackElements"]);
  assert.match(inv.contentSha256, /^[0-9a-f]{64}$/);
});

test("buildInventory: no build sha -> problem; unknown locale -> problem", () => {
  const fx = fixture({ files: { "xx-yy/index.html": page() }, routes: [{ route: "/xx-yy", rewrite: "/xx-yy/index.html" }], locs: [`${HOST}/xx-yy`] });
  const inv = run(fx, { env: {}, gitSha: () => null });
  const codes = inv.problems.map((p) => p.code);
  assert.ok(codes.includes("no_build_sha")); assert.ok(codes.includes("unknown_locale"));
  assert.equal(inv.buildSha, null); assert.equal(inv.deployRunId, null); assert.equal(inv.rows[0].locale, null);
});

test("buildInventory: no_main is a problem, row still emitted", () => {
  const fx = fixture({ files: { "en-gb/index.html": "<html><body>x</body></html>" }, routes: [{ route: "/en-gb", rewrite: "/en-gb/index.html" }], locs: [`${HOST}/en-gb`] });
  const inv = run(fx);
  assert.equal(inv.rows.length, 1);
  assert.deepEqual(inv.problems.find((p) => p.code === "no_main").path, "/en-gb");
});

test("buildInventory: build failures", () => {
  const base = { files: { "en-gb/index.html": page() }, routes: [{ route: "/en-gb", rewrite: "/en-gb/index.html" }, { route: "/r", redirect: "/en-gb", statusCode: 301 }] };
  assert.throws(() => run(fixture({ ...base, locs: [`${HOST}/en-gb/missing`] })), /missing/);
  assert.throws(() => run(fixture({ ...base, locs: [`${HOST}/r`] })), /redirect/i);
  assert.throws(() => run(fixture({ ...base, locs: ["https://evil.example/en-gb"] })), /evil\.example/);
  assert.throws(() => run(fixture({ ...base, locs: ["http://www.universaltill.com/en-gb"] })), /https/);
  assert.throws(() => run(fixture({ ...base, locs: [`${HOST}/en-gb`, `${HOST}/en-gb`] })), /duplicate/i);
  assert.throws(() => run(fixture({ ...base, locs: [] })), /sitemap/i);
  const empty = fixture({ ...base, locs: [] }); fs.rmSync(path.join(empty.distDir, "sitemap.xml"));
  assert.throws(() => run(empty), /sitemap/i);
});

test("buildInventory: size cap", () => {
  assert.throws(() => run(std(), { maxBytes: 100 }), /31457280|100|bytes/);
  assert.doesNotThrow(() => run(std()));
});

test("validateKeywordMap", () => {
  const urls = ["en-gb", "de-de"];
  const ok = { schemaVersion: "1.0", terms: [{ term: "Free Till", locale: "en-gb", owner: "/", supporting: ["/blog/x/"], card: "ut-docs#4320" }] };
  assert.doesNotThrow(() => validateKeywordMap(ok, urls));
  const bad = (t) => assert.throws(() => validateKeywordMap({ schemaVersion: "1.0", terms: [{ ...ok.terms[0], ...t }] }, urls));
  bad({ term: "  " }); bad({ locale: "fr-fr" }); bad({ owner: "download" }); bad({ supporting: ["x"] }); bad({ card: "#12" });
  assert.throws(() => validateKeywordMap({ ...ok, schemaVersion: "2.0" }, urls));
  assert.throws(() => validateKeywordMap({ schemaVersion: "1.0", terms: [ok.terms[0], { ...ok.terms[0], term: "free till" }] }, urls), /duplicate/i);
});

test("declaredOwners: full paths, sorted, owner_not_in_sitemap problem", () => {
  const map = { schemaVersion: "1.0", terms: [
    { term: "b", locale: "en-gb", owner: "/", supporting: ["/blog/x/"], card: "ut-docs#1" },
    { term: "a", locale: "en-gb", owner: "/nowhere", supporting: [], card: "ut-docs#1" },
  ] };
  const d = declaredOwners(map, new Set(["/en-gb"]));
  assert.deepEqual(d.owners.map((o) => o.term), ["a", "b"]);
  assert.deepEqual(d.owners[1], { term: "b", locale: "en-gb", owner: "/en-gb", supporting: ["/en-gb/blog/x/"], card: "ut-docs#1" });
  assert.deepEqual(d.problems, [{ path: "/en-gb/nowhere", code: "owner_not_in_sitemap", message: d.problems[0].message }]);
  const inv = run(std(), { map });
  assert.ok(inv.problems.some((p) => p.code === "owner_not_in_sitemap"));
  assert.equal(inv.declaredOwners.length, 2);
});

test("determinism: only computedAt / deployRunId differ", () => {
  const fx = std();
  const a = run(fx, { now: new Date("2030-01-01T00:00:00Z"), env: { GITHUB_SHA: "abc", GITHUB_RUN_ID: "1" } });
  const b = run(fx, { now: new Date("2031-05-05T05:05:05Z"), env: { GITHUB_SHA: "abc", GITHUB_RUN_ID: "2" } });
  assert.equal(a.contentSha256, b.contentSha256);
  assert.deepEqual(a.rows, b.rows);
  const strip = (o) => ({ ...o, computedAt: 0, deployRunId: 0 });
  assert.equal(serializeInventory(strip(a)), serializeInventory(strip(b)));
  assert.ok(serializeInventory(a).endsWith("}\n"));
});

// Tester additions (ut-docs#6887): mutations that survived the Dev's suite.
test("problems are sorted by path then code, independent of sitemap order", () => {
  const fx = fixture({
    files: { "zz-zz/index.html": "<html><body>x</body></html>", "aa-aa/index.html": "<html><body>y</body></html>" },
    routes: [{ route: "/zz-zz", rewrite: "/zz-zz/index.html" }, { route: "/aa-aa", rewrite: "/aa-aa/index.html" }],
    locs: [`${HOST}/zz-zz`, `${HOST}/aa-aa`],
  });
  const inv = run(fx);
  assert.deepEqual(inv.problems.map((p) => [p.path, p.code]), [
    ["/aa-aa", "no_main"], ["/aa-aa", "unknown_locale"], ["/zz-zz", "no_main"], ["/zz-zz", "unknown_locale"],
  ]);
});

test("text fields are NFC-normalised", () => {
  const r = extractPage(page({ title: "Cafe\u0301", main: "<main><h1>Cafe\u0301</h1></main>" }), { pageUrl: HOST + "/en-gb", isSource: true });
  assert.equal(r.title, "Caf\u00e9"); assert.equal(r.bodyText, "Caf\u00e9"); assert.equal(r.headings[0].text, "Caf\u00e9");
});

// Reviewer addition (ut-docs#6887): a percent-encoded sitemap path resolves to
// its decoded file name, as on Azure and in serve-site.js; the row keeps the
// sitemap's encoded path.
test("buildInventory: percent-encoded sitemap path resolves to the decoded file", () => {
  const fx = fixture({ files: { "en-gb/blog/caf\u00e9/index.html": page() }, routes: [], locs: [`${HOST}/en-gb/blog/caf%C3%A9/`] });
  assert.deepEqual(run(fx).rows.map((r) => r.path), ["/en-gb/blog/caf%C3%A9/"]);
  assert.throws(() => run(fixture({ files: {}, routes: [], locs: [`${HOST}/en-gb/%E0%A4%A`] })), /percent-encoding/);
});
