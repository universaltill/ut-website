// node --test src/lib/help_test.mjs - unit tests for src/lib/help.ts and
// src/lib/helpSource.ts (ut-docs#5355) over a tiny fixture in a temp dir; no
// network. esbuild bundles the TypeScript (same approach as plugins_test.mjs);
// npm packages stay external so they resolve from node_modules.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const CACHE = path.join(root, "node_modules", ".cache");
fs.mkdirSync(CACHE, { recursive: true });
const TMP = fs.mkdtempSync(path.join(CACHE, "help-test-"));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

async function load(file) {
  const out = path.join(TMP, `${path.basename(file, ".ts")}.mjs`);
  await build({ entryPoints: [path.join(here, file)], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "silent", packages: "external" });
  return import(pathToFileURL(out).href);
}
const H = await load("help.ts");
const S = await load("helpSource.ts");

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);

function topic({ id, title, order, section = "Everyday selling", extra = "", body = "" }) {
  return `---\nid: ${id}\ntitle: ${title}\nsection: ${section}\norder: ${order}\nsummary: "Sum of ${id}."\n# a comment {{ helpLink "x" }}\nkeywords: [alpha, beta gamma]\nroutes: [/, /refund/{receipt}]\n${extra}---\n\n# ${title}\n\n${body}\n`;
}

function fixture(files, images = {}) {
  const dir = fs.mkdtempSync(path.join(TMP, "src-"));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  for (const [rel, bytes] of Object.entries(images)) {
    fs.mkdirSync(path.dirname(path.join(dir, "img", rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, "img", rel), bytes);
  }
  return dir;
}

test("front-matter is parsed and removed from the body, comments ignored", () => {
  const t = H.parseTopic(topic({ id: "sell", title: "Selling", order: 10, body: "Hello." }), "sell", "en-gb", "en");
  assert.equal(t.title, "Selling");
  assert.equal(t.order, 10);
  assert.deepEqual(t.keywords, ["alpha", "beta gamma"]);
  assert.deepEqual(t.routes, ["/", "/refund/{receipt}"]);
  assert.equal(t.body.trim(), "Hello.");
  assert.doesNotMatch(t.body, /keywords:|order:|^---/m);
});

test("a broken or mismatched front-matter fails loudly", () => {
  assert.throws(() => H.parseTopic("no front matter", "a", "en-gb", "en"), /front-matter/);
  assert.throws(() => H.parseTopic(topic({ id: "b", title: "T", order: 1 }), "a", "en-gb", "en"), /does not match/);
  assert.throws(() => H.parseFrontMatter("---\nid: a\n  wrapped: line\n---\n"), /unsupported/);
});

test("public flag, allow-list and public:false precedence", () => {
  const allow = new Set(["listed"]);
  assert.equal(H.isPublic(undefined, "listed", allow), true);
  assert.equal(H.isPublic(undefined, "other", allow), false);
  assert.equal(H.isPublic(true, "other", allow), true);
  assert.equal(H.isPublic(false, "listed", allow), false);
  assert.deepEqual(H.parseAllowlist("# c\nsell  # trailing\n\n  tables\n# x\n"), ["sell", "tables"]);
});

test("deny list beats public:true and the allow-list", () => {
  const allow = new Set(["listed"]);
  const deny = new Set(["claim", "listed"]);
  assert.equal(H.isPublic(true, "claim", allow, deny), false);
  assert.equal(H.isPublic(undefined, "listed", allow, deny), false);
  assert.equal(H.isPublic(true, "other", allow, deny), true);
  assert.equal(H.isPublic(true, "claim", allow), true, "no deny list = old behaviour");
});

test("buildHelp never publishes a denied topic even when public: true", async () => {
  const dir = fixture({
    "en/claim.md": topic({ id: "claim", title: "Claim", order: 1, extra: "public: true\n" }),
    "en/sell.md": topic({ id: "sell", title: "Sell", order: 2, extra: "public: true\n" }),
  });
  const help = await H.buildHelp(dir, "t", "", "# c\nclaim # owner\n");
  assert.deepEqual(help.entries.map((e) => e.slug), ["sell"]);
});

test("link rewriting: public slug, non-public slug, till route, external, helpLink", async () => {
  const dir = fixture({
    "en/a.md": topic({
      id: "a",
      title: "Alpha",
      order: 1,
      body: [
        "See [the b topic](/help/b) and [anchored](/help/b#how) and [secret](/help/hidden) and [settings](/settings).",
        "Ext [site](https://example.com/x) and [bad](javascript:alert(1)).",
        'Also {{ helpLink "b" }} and <script>x</script> text `<user>` ok.',
        "",
        "| a | b |",
        "|---|---|",
        "| 1 | 2 |",
        "",
        "## How it works",
      ].join("\n"),
    }),
    "en/b.md": topic({ id: "b", title: "Bravo", order: 2 }),
    "en/hidden.md": topic({ id: "hidden", title: "Hidden", order: 3, extra: "public: false\n" }),
  });
  const help = await H.buildHelp(dir, "fixture", "a\nb\nhidden\n");
  assert.deepEqual(help.entries.map((e) => e.slug), ["a", "b"]);
  const html = help.entries[0].translations["de-de"]?.html ?? help.entries[0].en.html;
  assert.match(html, /href="\/en-gb\/help\/b\/"/);
  assert.match(html, /href="\/en-gb\/help\/b\/#how"/);
  assert.match(html, />Bravo<\/a>/, "helpLink becomes a link titled with the topic");
  assert.doesNotMatch(html, /\/help\/hidden|href="\/settings"|javascript:|<script|\{\{/);
  assert.match(html, /secret/, "non-public link text stays");
  assert.match(html, /href="https:\/\/example.com\/x" rel="noopener"/);
  assert.match(html, /<div class="help-table">\s*<table>/);
  assert.match(html, /<h2 id="how-it-works">/);
  assert.match(html, /<code>&#x3C;user><\/code>|<code>&lt;user&gt;<\/code>/);
});

function captureWarn(fn) {
  const warns = [];
  const real = console.warn;
  console.warn = (...a) => warns.push(a.join(" "));
  const done = () => { console.warn = real; return warns; };
  return fn(warns).then((r) => ({ r, warns: done() }), (e) => { done(); throw e; });
}

test("allow-listed slug missing from source or public:false upstream only warns; no allow-list file is fine", async () => {
  const dir = fixture({
    "en/a.md": topic({ id: "a", title: "A", order: 1 }),
    "en/off.md": topic({ id: "off", title: "Off", order: 2, extra: "public: false\n" }),
  });
  const { r, warns } = await captureWarn(() => H.buildHelp(dir, "fixture", "a\nghost\noff\n"));
  assert.deepEqual(r.entries.map((e) => e.slug), ["a"]);
  assert.ok(warns.some((w) => /ghost/.test(w)), warns.join("|"));
  assert.ok(warns.some((w) => /off/.test(w) && /public: false/.test(w)), warns.join("|"));
  const none = await captureWarn(() => H.buildHelp(dir, "fixture", null));
  assert.deepEqual(none.r.entries, [], "no allow-list, no flag: nothing public");
  const flagged = fixture({ "en/a.md": topic({ id: "a", title: "A", order: 1, extra: "public: true\n" }) });
  assert.equal((await H.buildHelp(flagged, "fixture", null)).entries.length, 1);
});

test("public must be exactly unquoted true/false; anything else is NOT public (fail closed)", async () => {
  for (const v of ['"true"', "'true'", "yes", "True", "1", "true # x y"]) {
    const t = H.parseTopic(topic({ id: "a", title: "A", order: 1, extra: `public: ${v}\n` }), "a", "en-gb", "en");
    assert.equal(H.isPublic(t.publicFlag, "a", new Set(["a"])), false, v);
  }
  const ok = H.parseTopic(topic({ id: "a", title: "A", order: 1, extra: "public: true\n" }), "a", "en-gb", "en");
  assert.equal(ok.publicFlag, true);
  const bad = fixture({ "en/a.md": topic({ id: "a", title: "A", order: 1, extra: 'public: "true"\n' }) });
  const { r, warns } = await captureWarn(() => H.buildHelp(bad, "fixture", "a\n"));
  assert.deepEqual(r.entries, []);
  assert.ok(warns.some((w) => /public/.test(w)));
});

test("quoted commas inside a list are kept; bad slugs and unparseable non-public topics are skipped with a warning", async () => {
  assert.deepEqual(H.parseFrontMatter('---\nkeywords: ["a, b", c, \'d, e\']\n---\n').data.keywords, ["a, b", "c", "d, e"]);
  const dir = fixture({
    "en/a.md": topic({ id: "a", title: "A", order: 1 }),
    "en/Bad_Slug.md": topic({ id: "Bad_Slug", title: "B", order: 2 }),
    "en/broken.md": "no front matter at all",
  });
  const { r, warns } = await captureWarn(() => H.buildHelp(dir, "fixture", "a\nbroken\n"));
  assert.deepEqual(r.entries.map((e) => e.slug), ["a"]);
  assert.ok(warns.some((w) => /Bad_Slug/.test(w)));
  assert.ok(warns.some((w) => /broken/.test(w)));
});

test("missing translation falls back to English; links use the page's locale", async () => {
  const dir = fixture(
    {
      "en/a.md": topic({ id: "a", title: "Alpha", order: 1, body: "[b](/help/b)" }),
      "en/b.md": topic({ id: "b", title: "Bravo", order: 2 }),
      "de/a.md": topic({ id: "a", title: "Alfa", order: 1, body: "[b](/help/b)" }),
      "fa/b.md": topic({ id: "b", title: "Bee", order: 2 }),
    },
    { "en/a.png": PNG, "de/b.png": PNG },
  );
  const help = await H.buildHelp(dir, "fixture", "a\nb\n");
  const [a, b] = help.entries;
  assert.equal(H.localized(a, "de-de").topic.title, "Alfa");
  assert.equal(H.localized(a, "de-de").isFallback, false);
  assert.equal(H.localized(b, "de-de").isFallback, true);
  assert.equal(H.localized(b, "de-de").topic.title, "Bravo");
  assert.equal(H.localized(a, "zh-cn").isFallback, true);
  assert.equal(H.localized(a, "en-gb").isFallback, false);
  assert.match(H.localized(a, "de-de").topic.html, /href="\/de-de\/help\/b\/"/);
  assert.deepEqual(H.translatedLocales(a), ["en-gb", "de-de"]);
  assert.deepEqual(H.translatedLocales(b), ["en-gb", "fa-ir"]);
  // images: own folder first, then English; both copied once
  assert.equal(a.images["de-de"], "/help-img/en/a.png");
  assert.equal(b.images["de-de"], "/help-img/de/b.png");
  assert.equal(b.images["tr-tr"], null);
  assert.deepEqual([...help.imageFiles.keys()].sort(), ["/help-img/de/b.png", "/help-img/en/a.png"]);
});

test("a bad image (not PNG / too big) is dropped with a warning; the topic stays", async () => {
  const svg = fixture({ "en/a.md": topic({ id: "a", title: "A", order: 1 }) }, { "en/a.png": Buffer.from("<svg onload=alert(1)>") });
  let x = await captureWarn(() => H.buildHelp(svg, "fixture", "a\n"));
  assert.equal(x.r.entries.length, 1);
  assert.equal(x.r.entries[0].images["en-gb"], null);
  assert.equal(x.r.imageFiles.size, 0);
  assert.ok(x.warns.some((w) => /not a PNG/.test(w)));
  const big = fixture({ "en/a.md": topic({ id: "a", title: "A", order: 1 }) }, { "en/a.png": Buffer.concat([PNG, Buffer.alloc(1024 * 1024)]) });
  x = await captureWarn(() => H.buildHelp(big, "fixture", "a\n"));
  assert.equal(x.r.entries[0].images["en-gb"], null);
  assert.ok(x.warns.some((w) => /limit/.test(w)));
});

test("hostile Markdown is stripped or escaped", async () => {
  const body = [
    "<div onclick=\"x()\">block html</div>",
    "",
    "<img src=x onerror=alert(1)> inline <b onmouseover=1>b</b>",
    "",
    "[a](JaVaScRiPt:alert(1)) [b](javascript:alert(2)) [c](//evil.example/x) [d](data:text/html,x) [e](vbscript:x)",
    "",
    "<javascript:alert(3)> <https://auto.example/p> <mailto:a@b.example>",
    "",
    "[f](https://a.example/\" onmouseover=\"alert(4))",
    "",
    "![i](https://evil.example/t.png)",
  ].join("\n");
  const dir = fixture({ "en/a.md": topic({ id: "a", title: "A", order: 1, body }) });
  const html = (await H.buildHelp(dir, "fixture", "a\n")).entries[0].en.html;
  assert.doesNotMatch(html, /<div onclick|<img|onerror|<b |href="\s*(?:javascript|vbscript|data):|href="\/\/|evil\.example\/t\.png/i);
  assert.doesNotMatch(html, /<a [^>]*onmouseover/i, html);
  assert.match(html, /href="https:\/\/auto\.example\/p" rel="noopener"/);
  assert.match(html, /href="mailto:a@b\.example"/);
});

test("replacement strings: a $ in text is kept by the page helpers", () => {
  assert.equal(H.fillTemplate("Hi {name} and {name}", { name: "$& $1 $$" }), "Hi $& $1 $$ and {name}");
});

test("prev/next by order, related in the same section, sections by min order", async () => {
  const mk = (id, order, section) => ({ slug: id, order, section });
  const es = [mk("c", 30, "S2"), mk("a", 10, "S1"), mk("b", 20, "S1"), mk("d", 40, "S1"), mk("e", 50, "S1"), mk("f", 60, "S1"), mk("g", 5, "S2")];
  assert.equal(H.neighbours(es, "a").prev?.slug, "g");
  assert.equal(H.neighbours(es, "a").next?.slug, "b");
  assert.equal(H.neighbours(es, "f").next, undefined);
  assert.deepEqual(H.related(es, "b").map((e) => e.slug), ["a", "d", "e", "f"]);
  assert.equal(H.related(es, "b", 2).length, 2);
  assert.deepEqual(H.groupBySection(es).map((g) => g.section), ["S2", "S1"]);
});

test("helpSource: HELP_SRC_DIR is used as-is; a bad one fails", async () => {
  const dir = fixture({ "en/a.md": topic({ id: "a", title: "A", order: 1 }) });
  S.resetHelpSourceCache();
  assert.deepEqual(await S.ensureHelpSource({ HELP_SRC_DIR: dir }), { dir, ref: "fixture" });
  S.resetHelpSourceCache();
  await assert.rejects(S.ensureHelpSource({ HELP_SRC_DIR: path.join(TMP, "nope") }), /no en\/ folder/);
  S.resetHelpSourceCache();
});

test("helpSource: latest tag read from the API with the token; failure returns null", async () => {
  const real = globalThis.fetch;
  let seen;
  globalThis.fetch = async (url, init) => {
    seen = { url, init };
    return new Response(JSON.stringify({ tag_name: "v1.2.3" }), { status: 200 });
  };
  assert.equal(await S.latestReleaseTag({ GITHUB_TOKEN: "tok" }), "v1.2.3");
  assert.match(seen.url, /releases\/latest$/);
  assert.equal(seen.init.headers.Authorization, "Bearer tok");
  globalThis.fetch = async () => new Response("no", { status: 403 });
  const warn = console.warn;
  console.warn = () => {};
  assert.equal(await S.latestReleaseTag({}), null);
  console.warn = warn;
  globalThis.fetch = real;
});

test("helpSource: highest vX.Y.Z tag from ls-remote output; CI fails instead of falling back to main", async () => {
  const out = ["a\trefs/tags/v0.9.0", "b\trefs/tags/v0.35.3", "c\trefs/tags/v0.35.10", "d\trefs/tags/v1.0.0-rc1", "e\trefs/tags/nightly"].join("\n");
  assert.equal(S.highestTag(out), "v0.35.10");
  assert.equal(S.highestTag("x\trefs/tags/foo"), null);
  const none = { latest: async () => null, lsRemote: () => null };
  assert.equal(await S.resolveRef({ HELP_REF: "v9.9.9" }, none), "v9.9.9");
  assert.equal(await S.resolveRef({}, { latest: async () => "v2.0.0", lsRemote: () => "x" }), "v2.0.0");
  assert.equal(await S.resolveRef({}, { latest: async () => null, lsRemote: () => "a\trefs/tags/v3.1.4" }), "v3.1.4");
  const real = console.warn;
  console.warn = () => {};
  assert.equal(await S.resolveRef({}, none), "main", "local build falls back to main");
  console.warn = real;
  await assert.rejects(S.resolveRef({ CI: "true" }, none), /CI/);
  await assert.rejects(S.resolveRef({ GITHUB_ACTIONS: "true" }, none), /CI/);
});

test("the summary sentence at the top of the body is not printed twice", () => {
  assert.equal(H.stripSummaryLead("Sum of a. More text here.\n\n## Next\n", "Sum of a.").trim().startsWith("More text here."), true);
  assert.equal(H.stripSummaryLead("Sum of a.\n\n## Next\n", "Sum of a."), "## Next\n");
  assert.equal(H.stripSummaryLead("Different.\n", "Sum of a."), "Different.\n");
  const t = H.parseTopic(topic({ id: "a", title: "A", order: 1, body: "Sum of a. Rest." }), "a", "en-gb", "en");
  assert.equal(t.body.trim(), "Rest.");
});

test("meta description is cut on a word boundary; section ids are stable", () => {
  assert.equal(H.metaDescription("Short."), "Short.");
  const d = H.metaDescription("word ".repeat(60), 40);
  assert.ok(d.length <= 40 && d.endsWith("\u2026") && !d.includes("wor\u2026"), d);
  assert.equal(H.sectionId("Setting up your shop"), "sec-setting-up-your-shop");
  assert.equal(H.sectionId("Connecting & extending"), "sec-connecting-extending");
});
