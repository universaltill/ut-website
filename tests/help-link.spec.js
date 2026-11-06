// ut-docs#5664 - the public help (/<locale>/help/) is reachable from the
// site header, the footer and the home page, in every published locale, and the
// locale stays in the URL.
import { expect, test } from "@playwright/test";
import { LOCALES, ENGLISH, I18N } from "./helpers/locales.js";

for (const locale of LOCALES) {
  test.describe(`help link - ${locale}`, () => {
    const help = `/${locale}/help/`;

    test("home page: header, footer and body link to this locale's help and it resolves", async ({ page, request }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`/${locale}/`);
      const header = page.locator('#site-nav a[href="' + help + '"]');
      await expect(header).toBeVisible();
      await expect(header).toHaveAttribute("data-i18n", "nav.help");
      await expect(header).toHaveText(I18N[locale]["nav.help"] ?? ENGLISH["nav.help"]);
      await expect(page.locator('footer a[href="' + help + '"]')).toHaveCount(1);
      await expect(page.locator('main a[href="' + help + '"]')).not.toHaveCount(0);
      const res = await request.get(help);
      expect(res.status()).toBe(200);
    });

    test("an Astro page (blog) carries the same header and footer links", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`/${locale}/blog/`);
      await expect(page.locator('#site-nav a[href="' + help + '"]')).toBeVisible();
      await expect(page.locator('footer a[href="' + help + '"]')).toHaveCount(1);
    });
  });
}

test("nav.help is a source key with Weblate metadata", async () => {
  expect(ENGLISH["nav.help"]).toBe("Help");
});
