// Regression coverage for ut-docs#1434's /pilot page. Independent review of
// the original PR flagged that the mailto: CTA's exact query-string content
// (subject/body encoding) and the hero/download links pointing at /pilot had
// no dedicated assertion — the green CSP/sitemap coverage those routes got
// was incidental (derived automatically from staticwebapp.config.json), not
// intentional protection for the mailto content itself. This closes that gap.
import { expect, test } from "@playwright/test";

const LOCALES = ["en-gb", "tr-tr", "zh-cn", "fa-ir", "de-de"];

test.describe("/pilot mailto CTA", () => {
  for (const locale of LOCALES) {
    test(`${locale}: mailto link has the right address, subject and body template`, async ({ page }) => {
      await page.goto(`/${locale}/pilot`);
      const href = await page.locator('a[data-i18n="pilot.cta"]').getAttribute("href");
      expect(href).toMatch(/^mailto:/);

      // Parse it as a real URL rather than regex-matching the raw string —
      // proves the encoding actually decodes to what a mail client would
      // send, not just that it "looks" percent-encoded.
      const url = new URL(href);
      expect(url.pathname).toBe("support@universaltill.com");
      const params = new URLSearchParams(url.search);
      expect(params.get("subject")).toBe("Join the pilot");
      const body = params.get("body");
      expect(body).toContain("Shop name:");
      expect(body).toContain("City, country:");
      expect(body).toContain("Current till");
      expect(body).toContain("Preferred language:");
    });
  }
});

test.describe("/pilot is linked from the home page and the download page", () => {
  for (const locale of LOCALES) {
    test(`${locale}: home hero links to /pilot`, async ({ page }) => {
      await page.goto(`/${locale}`);
      await expect(page.locator('a[data-i18n="hero.pilotlink"]')).toHaveAttribute("href", "/pilot");
    });

    test(`${locale}: download page links to /pilot`, async ({ page }) => {
      await page.goto(`/${locale}/download`);
      await expect(page.locator('a[data-i18n="dl.pilotlink"]')).toHaveAttribute("href", "/pilot");
    });
  }
});

test("fa-ir/pilot renders right-to-left", async ({ page }) => {
  await page.goto("/fa-ir/pilot");
  const dir = await page.evaluate(() => document.documentElement.dir);
  expect(dir).toBe("rtl");
});
