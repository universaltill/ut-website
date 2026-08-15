// ut-docs#353 — an RTL locale (currently only fa-ir) must never render
// genuinely-English, untranslated content with dir="rtl" inherited from
// <html>. BaseLayout sets that dir for the page chrome (nav/footer, which
// ARE translated) correctly; content regions that have no translation yet
// must force dir="ltr" on themselves rather than silently mis-rendering
// English prose right-to-left.
import { expect, test } from "@playwright/test";

test.describe("/plugins is entirely untranslated content and must force ltr", () => {
  for (const locale of ["fa-ir", "en-gb", "tr-tr", "zh-cn", "de-de"]) {
    test(`${locale}/plugins: the content section renders dir="ltr"`, async ({ page }) => {
      await page.goto(`/${locale}/plugins`);

      // The page chrome still follows the locale (this is the thing that
      // would break if the fix were "just force ltr on <html>" instead of
      // scoping it to the content region).
      const htmlDir = await page.evaluate(() => document.documentElement.dir);
      expect(htmlDir).toBe(locale === "fa-ir" ? "rtl" : "ltr");

      // The content itself — real GitHub-manifest data, never translated —
      // must always read ltr, regardless of the surrounding page's locale.
      const section = page.locator("main section.section").first();
      await expect(section).toHaveAttribute("dir", "ltr");
      await expect(section).toHaveAttribute("lang", "en");
    });
  }

  test("fa-ir/plugins: plugin cards are actually visible and readable left-to-right", async ({ page }) => {
    await page.goto("/fa-ir/plugins");
    const firstCard = page.locator(".card").first();
    await expect(firstCard).toBeVisible();
    const dir = await firstCard.evaluate((el) => getComputedStyle(el).direction);
    expect(dir).toBe("ltr");
  });
});

test.describe("blog post title/byline follow the post's own translation state", () => {
  // Real content, not a fixture: every current fa-ir post is machineTranslated
  // (a real translation, just an automated one) and NOT isFallback — the case
  // that must keep the locale's own dir. (The inverse case — isFallback,
  // genuinely no translation at all — has no real content to test against
  // right now, since every locale currently has both existing posts
  // translated; verified manually instead by temporarily removing a
  // translation file, rebuilding, and confirming h1/meta/body all render
  // dir="ltr" lang="en", then restoring it — ut-docs#353 review.)
  test("fa-ir/blog-is-live (machine-translated, not a fallback): title and byline stay rtl", async ({ page }) => {
    await page.goto("/fa-ir/blog/blog-is-live");
    const [h1Dir, metaDir] = await Promise.all([
      page.locator("article h1").evaluate((el) => el.dir || getComputedStyle(el).direction),
      page.locator("article > p").first().evaluate((el) => el.dir || getComputedStyle(el).direction),
    ]);
    expect(h1Dir).toBe("rtl");
    expect(metaDir).toBe("rtl");
  });
});

test.describe("homepage links to the real plugin catalogue (ut-docs#353 AC2)", () => {
  for (const locale of ["en-gb", "fa-ir", "tr-tr", "zh-cn", "de-de"]) {
    test(`${locale}: the #plugins section has a working link to /plugins`, async ({ page }) => {
      await page.goto(`/${locale}`);
      const cta = page.locator('#plugins a[data-i18n="plugins.cta"]');
      await expect(cta).toBeVisible();
      await expect(cta).toHaveAttribute("href", "/plugins");
    });
  }

  // Exact expected strings, not just "differs from English" — a weaker
  // inequality check would still pass if, say, tr-tr and zh-cn were left
  // identical to each other (both untranslated) while only fa-ir got a
  // real translation (review finding: the original version of this test
  // only ever compared fa-ir against en-gb, so tr-tr/zh-cn had no coverage
  // at all and either could have silently shipped in English).
  const EXPECTED_CTA = {
    "en-gb": "Browse all plugins",
    "tr-tr": "Tüm eklentilere göz atın",
    "zh-cn": "浏览所有插件",
    "fa-ir": "مشاهدهٔ همهٔ افزونه‌ها",
    "de-de": "Alle Plugins durchsuchen",
  };

  for (const [locale, expected] of Object.entries(EXPECTED_CTA)) {
    test(`${locale}: the CTA is translated, not left in English or copy-pasted`, async ({ page }) => {
      await page.goto(`/${locale}`);
      const text = await page.locator('#plugins a[data-i18n="plugins.cta"]').innerText();
      expect(text).toBe(expected);
    });
  }
});
