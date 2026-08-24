// Regression tests for ut-docs#442 (Content-Security-Policy on
// staticwebapp.config.json's globalHeaders) — a real browser, not just a
// clean build, per this card's own "Note on session type" caveat: a CSP
// header that parses fine can still silently block a script/style/fetch the
// page actually needs, and nothing about a build failing would ever tell
// you that.
//
// Two things every page is checked for:
//  1. The response actually carries the header (scripts/serve-site.js
//     applies site/staticwebapp.config.json's globalHeaders — see its own
//     comment for why that has to be real, not hand-approximated).
//  2. The real browser reports zero `securitypolicyviolation` events while
//     the page runs — caught via an injected listener. Reading a
//     <script type="application/ld+json">'s textContent, as seo.spec.js
//     does, would NOT catch a CSP regression there even in principle:
//     script-src only ever governs a <script> whose type is empty/a JS MIME
//     type/"module"/"importmap" (see scripts/generate-csp.js's file header
//     for the full story, including the mistake an independent review of
//     this ticket caught in an earlier draft) — a JSON-LD block's tag and
//     text stay in the DOM and readable whether or not a CSP would ever
//     block it, so DOM presence alone proves nothing about the CSP. The
//     securitypolicyviolation listener is what actually tests it.
//
// Page list is DERIVED from real source files (staticwebapp.config.json's
// route table, the blog content directory), same convention seo.spec.js
// documents and follows — a hand-copied path list can drift from what the
// site actually serves without this suite ever noticing.
import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const LOCALES = ["en-gb", "tr-tr", "zh-cn", "fa-ir", "de-de"];

const swaConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "site/staticwebapp.config.json"), "utf8"));
const MARKETING_SUFFIXES = swaConfig.routes
  .filter((r) => r.route.startsWith("/en-gb") && typeof r.rewrite === "string" && r.rewrite.endsWith(".html"))
  .map((r) => r.route.slice("/en-gb".length)); // "", "/download", "/start", "/store", "/language"

const BLOG_SOURCE_DIR = path.join(ROOT, "src/content/blog/en-gb");
const FIRST_SLUG = fs
  .readdirSync(BLOG_SOURCE_DIR)
  .filter((f) => f.endsWith(".mdx"))
  .map((f) => f.replace(/\.mdx$/, ""))
  .sort()[0];

// Every real page this site serves, one locale (en-gb) of each kind plus a
// full-locale sweep of the plain marketing pages below — a mix, not
// exhaustive cross-product, to keep this suite's runtime reasonable while
// still covering every DISTINCT page shape (plain site/*.html, Astro blog
// index, Astro blog post, Astro /plugins) at least once for CSP violations.
const ALL_PAGES = [
  ...MARKETING_SUFFIXES.map((s) => `/en-gb${s}`),
  "/en-gb/blog",
  `/en-gb/blog/${FIRST_SLUG}`,
  "/en-gb/plugins",
];

async function collectCspViolations(page) {
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      window.__cspViolations.push({ directive: e.violatedDirective, blocked: e.blockedURI });
    });
  });
}

test.describe("Content-Security-Policy header", () => {
  for (const path of ALL_PAGES) {
    test(`${path} response carries a restrictive CSP`, async ({ page }) => {
      const res = await page.goto(path);
      const csp = res.headers()["content-security-policy"];
      expect(csp).toBeTruthy();
      expect(csp).toContain("default-src 'none'");
      expect(csp).not.toContain("unsafe-eval");
      // script-src must never blanket-allow inline — hashes only (plus 'self').
      expect(csp).toMatch(/script-src 'self'( 'sha256-[^']+')+/);
    });
  }

  // Every locale of the plain marketing pages, not just en-gb — the header
  // comes from globalHeaders (applies to every route uniformly), but this
  // proves serve-site.js's routing/rewrite handling doesn't accidentally
  // drop it for a non-default locale prefix.
  for (const locale of LOCALES) {
    for (const suffix of MARKETING_SUFFIXES) {
      test(`/${locale}${suffix || "/"} carries the CSP header`, async ({ page }) => {
        const res = await page.goto(`/${locale}${suffix}`);
        expect(res.headers()["content-security-policy"]).toBeTruthy();
      });
    }
  }
});

test.describe("no real CSP violations", () => {
  for (const path of ALL_PAGES) {
    test(`${path} triggers zero securitypolicyviolation events`, async ({ page }) => {
      await collectCspViolations(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const violations = await page.evaluate(() => window.__cspViolations);
      expect(violations, JSON.stringify(violations)).toEqual([]);
    });
  }

  // Specifically pins the MAJOR-1 fix: a blog post's JSON-LD <script> is NOT
  // in generate-csp.js's hash list at all (its type isn't a JS type, so
  // findInlineScriptHashes() skips it) — this proves that omission is
  // actually safe in a real browser, not just a theory. If a future browser
  // (or a future generate-csp.js change) started treating JSON-LD as
  // script-src's concern, this is what would turn red.
  test("a blog post's un-hashed JSON-LD block causes no script-src violation", async ({ page }) => {
    await collectCspViolations(page);
    await page.goto(`/en-gb/blog/${FIRST_SLUG}`);
    await page.waitForLoadState("networkidle");
    const violations = await page.evaluate(() => window.__cspViolations);
    expect(violations.filter((v) => v.directive.startsWith("script-src"))).toEqual([]);
    // And the block really is there and really is un-hashed content working
    // as intended (not, say, silently empty) — belt and braces with
    // seo.spec.js's own JSON-LD assertions, from the CSP suite's own angle.
    const raw = await page.locator('script[type="application/ld+json"]').textContent();
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  test("download.html's live GitHub Releases upgrade still runs under connect-src", async ({ page }) => {
    await collectCspViolations(page);
    await page.goto("/en-gb/download");
    await page.waitForLoadState("networkidle");
    const violations = await page.evaluate(() => window.__cspViolations);
    // Network to api.github.com may itself be unreachable in a sandboxed CI
    // runner (that's a network fact, not a CSP fact) — assert specifically
    // that connect-src never appears in a violation, rather than that the
    // fetch succeeded.
    expect(violations.filter((v) => v.directive === "connect-src")).toEqual([]);
  });
});
