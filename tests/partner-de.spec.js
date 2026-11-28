// ut-docs#7250: the named German partner card on /<locale>/contact.
// Exact data only: no phone, no email, no link, no placeholder element.
import { expect, test } from "@playwright/test";

import { LOCALES, RTL, I18N } from "./helpers/locales.js";

const LINES = ["HAAFT-IT", "Nima Haghighi", "Eisvogelweg 15", "54296 Trier"];
const card = (html) => {
  const m = html.match(/<article class="card" id="partner-de">([\s\S]*?)<\/article>/);
  return m ? m[1] : null;
};
const text = (h) => h.replace(/<[^>]+>/g, "|").replace(/\|+/g, "|").replace(/^\||\|$/g, "");

test.describe("#partner-de on /contact", () => {
  for (const locale of LOCALES) {
    test(`${locale}: card has the exact data, no link, no raw keys`, async ({ request }) => {
      const html = await (await request.get(`/${locale}/contact`)).text();
      const c = card(html);
      expect(c, "card exists").not.toBeNull();
      const t = text(c).split("|").map((s) => s.trim()).filter(Boolean);
      for (const l of LINES) expect(t).toContain(l);
      expect(t).toContain("USt-IdNr.:");
      expect(t).toContain("DE370378150");
      expect(c.match(/DE370378150/g)).toHaveLength(1);
      expect(c.match(/HAAFT-IT(?!-)/g).length).toBe(2); // address line + independence line
      expect(c).toContain(locale === "de-de" ? "<p data-i18n=\"contact.partnerde.country\">Deutschland</p>" : "<p data-i18n=\"contact.partnerde.country\"");
      expect(text(c)).not.toMatch(/\+\d|\d{3,}[ -]\d{3,}|@|zertifiz|certified|authori[sz]ed|reseller|Preis|price/i);
      expect(c).not.toMatch(/tel:|mailto:|<a[\s>]|<img|hidden|<!--/);
      expect(c).not.toMatch(/<p[^>]*>\s*<\/p>/);
      expect(text(c)).not.toMatch(/contact\.partnerde/);
      for (const l of LINES) expect(c).toContain(`<p dir="ltr">${l}</p>`);
      // card sits after #partners and before #security
      expect(html.indexOf('id="partners"')).toBeLessThan(html.indexOf('id="partner-de"'));
      expect(html.indexOf('id="partner-de"')).toBeLessThan(html.indexOf('id="security"'));
    });
  }

  test("en-gb: heading and independence line", async ({ request }) => {
    const c = card(await (await request.get("/en-gb/contact")).text());
    expect(c).toContain("Our partner in Germany");
    expect(c).toContain("HAAFT-IT is an independent business.");
    expect(c).toContain("Germany");
  });

  test("de-de: German text, not wrapped in the English fallback span", async ({ request }) => {
    const c = card(await (await request.get("/de-de/contact")).text());
    expect(c).toContain("Unser Partner in Deutschland");
    expect(c).toContain("Deutschland");
    expect(c).toContain("HAAFT-IT ist ein eigenständiges, unabhängiges Unternehmen.");
    expect(c).not.toContain("data-i18n-fallback");
    expect(I18N["de-de"]._fb).not.toContain("contact.partnerde.t");
  });

  test("the statutory label keeps lang=de and the value is ltr", async ({ request }) => {
    for (const l of ["en-gb", "fr-fr"]) {
      const c = card(await (await request.get(`/${l}/contact`)).text());
      expect(c).toContain('<span lang="de" dir="ltr">USt-IdNr.:</span>');
      expect(c).toContain('<bdi dir="ltr">DE370378150</bdi>');
    }
  });

  for (const locale of RTL) {
    test(`${locale}: data lines are dir=ltr in the browser`, async ({ page }) => {
      await page.goto(`/${locale}/contact`);
      const ps = page.locator("#partner-de address p[dir=ltr]");
      await expect(ps).toHaveCount(4);
      for (const i of [0, 1, 2, 3]) expect(await ps.nth(i).evaluate((e) => getComputedStyle(e).direction)).toBe("ltr");
    });
  }

  test("anchor lands below the sticky header (scroll-margin-top)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/de-de/contact#partner-de");
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({
      top: document.querySelector("#partner-de").getBoundingClientRect().top,
      header: document.querySelector("header").getBoundingClientRect().bottom,
    }));
    expect(r.top).toBeGreaterThanOrEqual(r.header);
  });

  for (const width of [320, 390]) {
    for (const locale of ["en-gb", "de-de", "ar-sa"]) {
      test(`${locale} at ${width}px: no horizontal overflow, address not italic`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(`/${locale}/contact`);
        const r = await page.evaluate(() => ({
          over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          style: getComputedStyle(document.querySelector("#partner-de address")).fontStyle,
        }));
        expect(r.over).toBeLessThanOrEqual(0);
        expect(r.style).toBe("normal");
      });
    }
  }
});
