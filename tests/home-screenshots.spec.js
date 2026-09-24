// ut-docs#2611: the home page's product screenshots are the first thing a
// shop owner judges the till by. Guards the three ways they silently rot:
// a renamed/removed file (broken image), a missing alt, and alt text left in
// English on a translated page (screen readers read the alt in place of the
// picture, so it must follow the page language like any visible string).
import { expect, test } from "@playwright/test";

const LOCALES = ["en-gb", "tr-tr", "zh-cn", "fa-ir", "de-de"];

for (const loc of LOCALES) {
  test(`/${loc} screenshots load and carry alt text in the page language`, async ({ page }) => {
    await page.goto(`/${loc}`);
    const imgs = page.locator("main img, section img");
    const n = await imgs.count();
    expect(n).toBeGreaterThan(8);
    for (let i = 0; i < n; i++) {
      const img = imgs.nth(i);
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0), {
        message: `image ${await img.getAttribute("src")} failed to load`,
      }).toBe(true);
      expect((await img.getAttribute("alt"))?.trim(), `alt on ${await img.getAttribute("src")}`).toBeTruthy();
    }
    // Every translatable alt must match the caption key's text in this locale.
    const pairs = await page.$$eval("[data-i18n-alt]", (els) =>
      els.map((el) => ({ key: el.getAttribute("data-i18n-alt"), alt: el.getAttribute("alt") })),
    );
    expect(pairs.length).toBeGreaterThan(8);
    for (const { key, alt } of pairs) {
      const caption = await page.locator(`[data-i18n="${key}"]`).first().textContent();
      expect(alt, `alt for ${key}`).toBe(caption);
    }
  });
}
