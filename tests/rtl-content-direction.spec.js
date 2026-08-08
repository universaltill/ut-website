// ut-docs#353 — an RTL locale (currently only fa-ir) must never render
// genuinely-English, untranslated content with dir="rtl" inherited from
// <html>. BaseLayout sets that dir for the page chrome (nav/footer, which
// ARE translated) correctly; content regions that have no translation yet
// must force dir="ltr" on themselves rather than silently mis-rendering
// English prose right-to-left.
import { expect, test } from "@playwright/test";

test.describe("/plugins is entirely untranslated content and must force ltr", () => {
  for (const locale of ["fa-ir", "en-gb", "tr-tr", "zh-cn"]) {
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

test.describe("homepage links to the real plugin catalogue (ut-docs#353 AC2)", () => {
  for (const locale of ["en-gb", "fa-ir", "tr-tr", "zh-cn"]) {
    test(`${locale}: the #plugins section has a working link to /plugins`, async ({ page }) => {
      await page.goto(`/${locale}`);
      const cta = page.locator('#plugins a[data-i18n="plugins.cta"]');
      await expect(cta).toBeVisible();
      await expect(cta).toHaveAttribute("href", "/plugins");
    });
  }

  test("the CTA text is actually translated per locale, not a copy-paste", async ({ page }) => {
    await page.goto("/en-gb");
    const en = await page.locator('#plugins a[data-i18n="plugins.cta"]').innerText();
    expect(en).toBe("Browse all plugins");

    await page.goto("/fa-ir");
    const fa = await page.locator('#plugins a[data-i18n="plugins.cta"]').innerText();
    expect(fa).not.toBe(en);
    expect(fa.length).toBeGreaterThan(0);
  });
});
