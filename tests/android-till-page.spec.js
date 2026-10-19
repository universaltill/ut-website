// ut-docs#4643: the Android till landing page. Google had nothing to rank for
// "android till" because no page, title or heading said it. This checks the
// page exists in every locale with its own title and description, carries
// FAQPage + SoftwareApplication structured data in the raw (JS-free) HTML,
// is in the sitemap, and is linked from the home and download pages.
import { expect, test } from "@playwright/test";

const LOCALES = ["en-gb", "tr-tr", "zh-cn", "fa-ir", "de-de"];
// The search phrase each locale's <title> must carry (owner's terms, #4643).
const PHRASE = {
  "en-gb": "Android till",
  "tr-tr": "Android POS",
  "zh-cn": "Android 收银系统",
  "fa-ir": "صندوق فروش اندروید",
  "de-de": "Kassensystem für Android",
};

function ldBlocks(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
}

test.describe("/android-till in every locale", () => {
  for (const locale of LOCALES) {
    test(`${locale}: raw HTML has its own title, description and structured data`, async ({ request }) => {
      const res = await request.get(`/${locale}/android-till`);
      expect(res.status()).toBe(200);
      const html = await res.text();

      const title = html.match(/<title[^>]*>([^<]*)<\/title>/)[1];
      expect(title).toContain(PHRASE[locale]);
      const desc = html.match(/<meta name="description"[^>]*content="([^"]*)"/)[1];
      expect(desc.length).toBeGreaterThan(50);
      expect(html).toContain(`<link rel="canonical" id="canonical" href="https://www.universaltill.com/${locale}/android-till">`);

      // Distinct from the home page: neither the title nor the description is reused.
      const home = await (await request.get(`/${locale}`)).text();
      expect(home.match(/<title[^>]*>([^<]*)<\/title>/)[1]).not.toBe(title);
      expect(home.match(/<meta name="description"[^>]*content="([^"]*)"/)[1]).not.toBe(desc);
      // No FAQ question is the home page's again (Google: mark up a repeated Q&A once).
      const homeFaq = ldBlocks(home).find((b) => b["@type"] === "FAQPage").mainEntity.map((q) => q.name);

      const blocks = ldBlocks(html);
      const faq = blocks.find((b) => b["@type"] === "FAQPage");
      expect(faq.mainEntity).toHaveLength(4);
      for (const q of faq.mainEntity) {
        expect(q.acceptedAnswer.text.length).toBeGreaterThan(20);
        expect(homeFaq).not.toContain(q.name);
      }
      const app = blocks.find((b) => b["@type"] === "SoftwareApplication");
      expect(app).toMatchObject({
        name: "Universal Till",
        operatingSystem: "Android",
        url: `https://www.universaltill.com/${locale}/android-till`,
        description: desc.replace(/&amp;/g, "&"),
        offers: { price: "0" },
      });
    });

    test(`${locale}: the visible FAQ matches the structured data`, async ({ page }) => {
      await page.goto(`/${locale}/android-till`);
      const visible = await page.locator(".faq-item summary").allTextContents();
      const ld = await page.evaluate(() =>
        [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent)),
      );
      const faq = ld.find((b) => b["@type"] === "FAQPage");
      expect(faq.mainEntity.map((q) => q.name)).toEqual(visible.map((t) => t.trim()));
      await expect(page.locator("h1")).toContainText(PHRASE[locale]);
    });

    test(`${locale}: linked from the home and download pages`, async ({ request }) => {
      const home = await (await request.get(`/${locale}`)).text();
      expect(home).toMatch(new RegExp(`<a href="/${locale}/android-till" data-i18n="hw.androidlink">`));
      const dl = await (await request.get(`/${locale}/download`)).text();
      expect(dl).toMatch(new RegExp(`<a href="/${locale}/android-till"[^>]*data-i18n="dl.android.about">`));
    });
  }
});

test("every locale's /android-till is in the sitemap", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  for (const locale of LOCALES) {
    expect(xml).toContain(`<loc>https://www.universaltill.com/${locale}/android-till</loc>`);
  }
});

for (const from of ["/android-till", "/android-till.html"]) {
  test(`${from} 301s to /en-gb/android-till`, async ({ request }) => {
    const res = await request.get(from, { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(res.headers()["location"]).toBe("/en-gb/android-till");
  });
}

test("fa-ir/android-till renders right-to-left", async ({ page }) => {
  await page.goto("/fa-ir/android-till");
  expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
});
