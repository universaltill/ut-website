// Regression tests for ut-docs#482 — blog SEO plumbing: sitemap.xml, an
// RSS feed per locale, and JSON-LD BlogPosting structured data on every
// post. All three follow the site's existing per-locale convention (the
// same one canonical/hreflang already use in BaseLayout.astro) rather than
// treating the blog as English-only.
//
// Expectations are DERIVED from the same source files the implementation
// itself reads (site/staticwebapp.config.json, the site/*.html markup, the
// blog content directory) rather than hand-copied literals — a hand-copied
// list can only ever confirm itself: it passed against a version of
// sitemap.xml.ts with a fully hardcoded marketingPaths() that ignored the
// config entirely. Reading the real files here means a route added to (or
// removed from) the config, or a post published, changes what this test
// expects too, not just what the implementation emits.
//
// Run against dist/ via scripts/serve-site.js, same as every other spec
// here. Fetches happen inside page.evaluate (not the `request` fixture)
// so DOMParser — a browser global, absent from the Node-side request
// context — is available to actually prove the XML parses, not just
// "looks XML-ish".
import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const LOCALES = ["en-gb", "tr-tr", "zh-cn", "fa-ir", "de-de"];

// Same route table sitemap.xml.ts itself reads — not a second hand-kept
// copy of the five paths, so this test can't drift from the config the
// way the implementation is specifically designed not to. Derived from
// the en-gb routes only, as path SUFFIXES ("", "/download", ...) — the
// config repeats the same five pages once per locale, and every locale
// serves the same underlying site/*.html files, so en-gb's route set is
// representative and the actual per-locale strings get built below.
const swaConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "site/staticwebapp.config.json"), "utf8"));
const EXPECTED_MARKETING_SUFFIXES = swaConfig.routes
  .filter((r) => r.route.startsWith("/en-gb") && typeof r.rewrite === "string" && r.rewrite.endsWith(".html") && !r.route.includes("*"))
  .filter((r) => {
    const html = fs.readFileSync(path.join(ROOT, "site", r.rewrite), "utf8");
    return !/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html);
  })
  .map((r) => r.route.slice("/en-gb".length)); // "", "/download", "/start", "/store"

// site/language.html is real but explicitly noindex (a language picker,
// not indexable content) — assert the derivation actually excludes it,
// so this fixture-derived list doesn't silently stop meaning anything.
if (!EXPECTED_MARKETING_SUFFIXES.includes("") || EXPECTED_MARKETING_SUFFIXES.includes("/language")) {
  throw new Error("EXPECTED_MARKETING_SUFFIXES derivation looks wrong — check site/staticwebapp.config.json parsing");
}

// Published (non-draft) post slugs, from the English source directory —
// the same set src/lib/blogPosts.ts treats as canonical. Reads frontmatter
// with a small regex rather than a YAML dependency; these files' front
// matter is hand-authored in the simple `key: value` shape already.
const BLOG_SOURCE_DIR = path.join(ROOT, "src/content/blog/en-gb");
const EXPECTED_SLUGS = fs
  .readdirSync(BLOG_SOURCE_DIR)
  .filter((f) => f.endsWith(".mdx"))
  .filter((f) => !/^draft:\s*true\s*$/m.test(fs.readFileSync(path.join(BLOG_SOURCE_DIR, f), "utf8")))
  .map((f) => f.replace(/\.mdx$/, ""))
  .sort();

async function fetchXml(page, path) {
  return page.evaluate(async (p) => {
    const res = await fetch(p);
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, "application/xml");
    return {
      status: res.status,
      text,
      contentType: res.headers.get("content-type") || "",
      wellFormed: !doc.querySelector("parsererror"),
    };
  }, path);
}

test.describe("sitemap.xml", () => {
  test("is served at the site root as well-formed XML", async ({ page }) => {
    await page.goto("/en-gb");
    const { status, text, wellFormed } = await fetchXml(page, "/sitemap.xml");
    expect(status).toBe(200);
    expect(text).toMatch(/^<\?xml/);
    expect(text).toContain("<urlset");
    expect(wellFormed).toBe(true);
  });

  test("lists every non-noindex marketing page in every locale, and nothing marked noindex", async ({ page }) => {
    await page.goto("/en-gb");
    const { text } = await fetchXml(page, "/sitemap.xml");
    for (const locale of LOCALES) {
      for (const suffix of EXPECTED_MARKETING_SUFFIXES) {
        expect(text, `missing /${locale}${suffix}`).toContain(`/${locale}${suffix}</loc>`);
      }
      // language.html is real (site/language.html exists, is routed, is
      // reachable) but noindex — proves the exclusion is doing something,
      // not just that the include list matches.
      expect(text, `/${locale}/language should be excluded (noindex)`).not.toContain(`/${locale}/language</loc>`);
    }
  });

  test("lists the blog index, every published post, and /plugins in every locale", async ({ page }) => {
    await page.goto("/en-gb");
    const { text } = await fetchXml(page, "/sitemap.xml");
    for (const locale of LOCALES) {
      // Trailing slash: matches these directory-style pages' own <link
      // rel="canonical"> (BaseLayout.astro), which the marketing pages
      // above deliberately don't carry — they're exact SWA route matches.
      expect(text).toContain(`/${locale}/blog/</loc>`);
      expect(text).toContain(`/${locale}/plugins/</loc>`);
      for (const slug of EXPECTED_SLUGS) {
        expect(text, `missing /${locale}/blog/${slug}`).toContain(`/${locale}/blog/${slug}/</loc>`);
      }
    }
    // Nothing extra: total <loc> count is exactly what the two derived
    // lists predict — catches a slug/route sitting in the sitemap that
    // shouldn't be there just as much as a missing one.
    const perLocale = EXPECTED_MARKETING_SUFFIXES.length + 2 /* blog index + plugins */ + EXPECTED_SLUGS.length;
    const locCount = (text.match(/<loc>/g) || []).length;
    expect(locCount).toBe(perLocale * LOCALES.length);
  });

  test("URLs are absolute, on the production host", async ({ page }) => {
    await page.goto("/en-gb");
    const { text } = await fetchXml(page, "/sitemap.xml");
    expect(text).toContain("https://www.universaltill.com/en-gb/blog/</loc>");
    expect(text).not.toMatch(/<loc>\/(?!\/)/); // no host-relative "/en-gb/..." entries
  });
});

test.describe("RSS feed", () => {
  for (const locale of LOCALES) {
    test(`/${locale}/blog/rss.xml is a valid feed listing every published post`, async ({ page }) => {
      await page.goto(`/${locale}`);
      const { status, text, wellFormed, contentType } = await fetchXml(page, `/${locale}/blog/rss.xml`);
      expect(status).toBe(200);
      expect(text).toMatch(/^<\?xml/);
      expect(text).toContain("<rss");
      expect(wellFormed).toBe(true);
      expect(contentType).toMatch(/xml/);
      // Count and slugs both derived from the real content directory —
      // publishing a new post changes this expectation along with the
      // feed, rather than turning CI red on a content-only commit.
      const itemCount = (text.match(/<item>/g) || []).length;
      expect(itemCount).toBe(EXPECTED_SLUGS.length);
      for (const slug of EXPECTED_SLUGS) {
        expect(text).toContain(`https://www.universaltill.com/${locale}/blog/${slug}`);
      }
    });
  }
});

test.describe("JSON-LD BlogPosting", () => {
  test("every post page carries a valid BlogPosting block", async ({ page }) => {
    const slug = EXPECTED_SLUGS[0];
    await page.goto(`/en-gb/blog/${slug}`);
    const raw = await page.locator('script[type="application/ld+json"]').textContent();
    const data = JSON.parse(raw);
    expect(data["@type"]).toBe("BlogPosting");
    // Trailing slash: matches this same page's own <link rel="canonical">.
    expect(data.mainEntityOfPage).toBe(`https://www.universaltill.com/en-gb/blog/${slug}/`);
    expect(data.headline).toBeTruthy();
    expect(data.datePublished).toBeTruthy();
    expect(data.inLanguage).toBe("en-GB");
    expect(data.author).toBeTruthy();
  });

  test("the block's URL is locale-correct on a translated post", async ({ page }) => {
    const slug = EXPECTED_SLUGS[0];
    await page.goto(`/tr-tr/blog/${slug}`);
    const raw = await page.locator('script[type="application/ld+json"]').textContent();
    const data = JSON.parse(raw);
    expect(data.mainEntityOfPage).toBe(`https://www.universaltill.com/tr-tr/blog/${slug}/`);
    expect(data.inLanguage).toBe("tr-TR");
  });
});
