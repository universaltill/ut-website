// Regression coverage for ut-docs#1434's /pilot page. Independent review of
// the original PR flagged that the mailto: CTA's exact query-string content
// (subject/body encoding) and the hero/download links pointing at /pilot had
// no dedicated assertion — the green CSP/sitemap coverage those routes got
// was incidental (derived automatically from staticwebapp.config.json), not
// intentional protection for the mailto content itself. This closes that gap.
import { expect, test } from "@playwright/test";

import { LOCALES } from "./helpers/locales.js";

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
      await expect(page.locator('a[data-i18n="hero.pilotlink"]')).toHaveAttribute("href", `/${locale}/pilot`);
    });

    test(`${locale}: download page links to /pilot`, async ({ page }) => {
      await page.goto(`/${locale}/download`);
      await expect(page.locator('a[data-i18n="dl.pilotlink"]')).toHaveAttribute("href", `/${locale}/pilot`);
    });
  }
});

test("fa-ir/pilot renders right-to-left", async ({ page }) => {
  await page.goto("/fa-ir/pilot");
  const dir = await page.evaluate(() => document.documentElement.dir);
  expect(dir).toBe("rtl");
});

// Owner decision 2026-11-11: the pilot is remote setup on hardware the shop
// already owns, and Germany is a shadow run (no TSE). The page must never
// promise hardware, white-glove/on-site service, or vendor/AI claims again.
test.describe("/pilot copy stays honest", () => {
  for (const locale of LOCALES) {
    test(`${locale}: no hardware promise, no vendor or AI claims`, async ({ page }) => {
      await page.goto(`/${locale}/pilot`);
      const items = await page.locator("main li").allTextContents();
      expect(items.length).toBeGreaterThanOrEqual(7);
      const text = (await page.locator("main").innerText()).toLowerCase();
      expect(text).not.toMatch(/white-glove|on-site|fiskaly|\bai\b/);
      if (locale === "en-gb") {
        expect(text).not.toContain("catalogue, hardware and training");
        expect(text).toContain("no hardware is supplied");
        expect(text).toContain("remotely");
        expect(text).toContain("not yet certified for fiscal use in germany");
        expect(text).toContain("shadow run");
      }
    });

    test(`${locale}: pilot.get.i2 promises no hardware; Germany bullet names TSE`, async ({ page }) => {
      await page.goto(`/${locale}/pilot`);
      const get = await page.locator('[data-i18n="pilot.get.i2"]').innerText();
      expect(get).not.toMatch(/hardware|donanım|硬件|سخت‌افزار/i);
      const de = await page.locator('[data-i18n="pilot.where.de"]').innerText();
      expect(de).toContain("TSE");
    });
  }
});
