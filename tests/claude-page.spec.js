// ut-docs#5318: "Use Universal Till in Claude" page in en/de/tr (+ honest
// fallback in fa/zh), and /.well-known/security.txt.
import { expect, test } from "@playwright/test";

const SECTIONS = ["what", "setup", "tools", "activation", "revoke", "data", "troubleshooting", "support"];
const REAL = ["en-gb", "de-de", "tr-tr"];
const FALLBACK = ["fa-ir", "zh-cn"];

for (const lang of REAL) {
  test.describe(`/${lang}/claude/`, () => {
    test("renders: one h1, 8 section ids, self canonical, hreflang", async ({ page }) => {
      const res = await page.goto(`/${lang}/claude/`);
      expect(res.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", new RegExp(`^${lang.split("-")[0]}`, "i"));
      await expect(page.locator("h1")).toHaveCount(1);
      for (const id of SECTIONS) await expect(page.locator(`article h2#${id}`)).toHaveCount(1);
      await expect(page.locator("article h3#proposals")).toHaveCount(1);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        new RegExp(`/${lang}/claude/$`),
      );
      for (const l of REAL) await expect(page.locator(`link[rel="alternate"][hreflang="${l}"]`)).toHaveCount(1);
      await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1);
      await expect(page.locator('[data-i18n="news.untranslated"]')).toHaveCount(0);
    });

    test("connector URL is selectable text and setup is a numbered list", async ({ page }) => {
      await page.goto(`/${lang}/claude/`);
      await expect(page.locator("article code", { hasText: "https://mcp.universaltill.com" })).toHaveCount(1);
      await expect(page.locator("article ol").first()).toBeVisible();
    });

    test("links to privacy and terms resolve", async ({ page, request }) => {
      await page.goto(`/${lang}/claude/`);
      for (const slug of ["privacy", "terms"]) {
        const href = `/${lang}/legal/${slug}/`;
        await expect(page.locator(`article a[href="${href}"]`)).toHaveCount(1);
        expect((await request.get(href)).status()).toBe(200);
      }
      await expect(page.locator('article a[href="/.well-known/security.txt"]')).toHaveCount(1);
    });

    test("360px: no horizontal scroll", async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 740 });
      await page.goto(`/${lang}/claude/`);
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(over).toBeLessThanOrEqual(0);
    });
  });
}

test("renders without JavaScript", async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto("/de-de/claude/");
  await expect(page.locator("article h2#setup")).toBeVisible();
  await expect(page.locator("article code")).toContainText("https://mcp.universaltill.com");
  await ctx.close();
});

for (const lang of FALLBACK) {
  test(`/${lang}/claude/ is an honest English fallback`, async ({ page }) => {
    await page.goto(`/${lang}/claude/`);
    await expect(page.locator('[data-i18n="news.untranslated"]')).toBeVisible();
    await expect(page.locator("article div[lang]").first()).toHaveAttribute("lang", "en");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/en-gb\/claude\/$/);
    await expect(page.locator(`link[rel="alternate"][hreflang="${lang}"]`)).toHaveCount(0);
  });
}

test("sitemap lists en/de/tr claude pages and not fa/zh", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  for (const l of REAL) expect(xml).toContain(`/${l}/claude/</loc>`);
  for (const l of FALLBACK) expect(xml).not.toContain(`/${l}/claude/</loc>`);
});

test("/claude redirects to /en-gb/claude/", async ({ request }) => {
  const res = await request.get("/claude", { maxRedirects: 0 });
  expect(res.status()).toBe(301);
  expect(res.headers()["location"]).toBe("/en-gb/claude/");
});

test("/.well-known/security.txt is served as text/plain and parses", async ({ request }) => {
  const res = await request.get("/.well-known/security.txt");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/plain");
  const body = await res.text();
  expect(body).toMatch(/^Contact: mailto:security@universaltill\.com$/m);
  expect(body).toMatch(/^Expires: \d{4}-\d{2}-\d{2}T/m);
  expect(body).toMatch(/^Canonical: https:\/\/www\.universaltill\.com\/\.well-known\/security\.txt$/m);
});
