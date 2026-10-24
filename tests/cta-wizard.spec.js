// ut-docs#4193 — every "Get started" / "Start free" / "Create your account" call
// to action on the site opens the wizard at /<locale>/find-your-setup (header,
// hero, every page, every locale). The wizard's own last step is the only place
// that links on to my.universaltill.com.
import { expect, test } from "@playwright/test";

const LOCALES = ["en-gb", "tr-tr", "zh-cn", "fa-ir", "de-de"];
const PAGES = ["", "/download", "/start", "/pilot", "/language", "/android-till", "/find-your-setup", "/plugins/", "/blog/", "/legal/privacy"];
const CTA = 'a[data-i18n="nav.start"], a[data-i18n="nav.get"], a[data-i18n="hero.cta1"]';

for (const locale of LOCALES) {
  for (const page of PAGES) {
    test(`${locale}${page || "/"}: every Get started button opens the wizard`, async ({ page: p }) => {
      const res = await p.goto(`/${locale}${page}`);
      expect(res.status()).toBe(200);
      const hrefs = await p.locator(CTA).evaluateAll((as) => as.map((a) => a.getAttribute("href")));
      expect(hrefs.length, "a Get started button exists").toBeGreaterThan(0);
      for (const h of hrefs) expect(h).toBe(`/${locale}/find-your-setup`);
    });
  }
}

test("no page links straight to my.universaltill.com from a Get started button", async ({ page }) => {
  await page.goto("/en-gb");
  const hrefs = await page.locator(CTA).evaluateAll((as) => as.map((a) => a.href));
  for (const h of hrefs) expect(h).not.toContain("my.universaltill.com");
});
