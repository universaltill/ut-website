// ut-docs#3805 — blog/legal dates follow the page locale (they were hard-coded
// en-GB), the date run is isolated with <bdi> so an RTL page doesn't reorder it
// against " · author", and the blog subtitle/empty-state no longer claim
// things that aren't true or aren't translated.
import { expect, test } from "@playwright/test";

const DE_MONTH = /(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)/;
const EN_MONTH = /(January|February|March|April|May|June|July|August|September|October|November|December)/;
// April/August/September/November are spelled the same in German, so the
// "no English month" check only uses months whose English spelling differs.
const EN_ONLY_MONTH = /(January|February|March|May|June|July|October|December)/;
const SUB = {
  "en-gb": "Product news, release notes and guides for Universal Till.",
  "de-de": "Produktneuigkeiten, Versionshinweise und Anleitungen zu Universal Till.",
  "tr-tr": "Universal Till ile ilgili ürün haberleri, sürüm notları ve kılavuzlar.",
  "zh-cn": "Universal Till 的产品新闻、版本说明和使用指南。",
  "fa-ir": "اخبار محصول، یادداشت‌های انتشار و راهنماهای Universal Till.",
};

test.describe("blog dates follow the locale", () => {
  test("de-de post: German month in the date line, no English month", async ({ request }) => {
    const html = await (await request.get("/de-de/blog/multiple-tills-one-shop/")).text();
    const m = html.match(/<bdi><time datetime="[^"]+">([^<]+)<\/time><\/bdi>/);
    expect(m, "date wrapped in bdi>time").not.toBeNull();
    expect(m[1]).toMatch(DE_MONTH);
    expect(m[1]).not.toMatch(EN_ONLY_MONTH);
  });

  test("de-de index: card dates German, h1 'Neuigkeiten', subtitle honest", async ({ page }) => {
    await page.goto("/de-de/blog/");
    await expect(page.locator("h1")).toHaveText("Neuigkeiten");
    const times = page.locator("a.card time[datetime]");
    expect(await times.count()).toBeGreaterThan(0);
    // Every index card's date follows the page locale — an English-fallback
    // post's card included (only the post page itself marks its date line
    // lang="en" and keeps the English date).
    for (const t of await times.all()) {
      const s = await t.innerText();
      expect(s).toMatch(DE_MONTH);
      expect(s).not.toMatch(EN_ONLY_MONTH);
    }
    const sub = await page.locator(".section-sub").innerText();
    expect(sub).toBe(SUB["de-de"]);
    expect(sub).not.toContain("Geschäften, die");
  });

  for (const [locale, sub] of Object.entries(SUB)) {
    test(`${locale}/blog: subtitle is the product-news line, not a shop-stories claim`, async ({ request }) => {
      const html = await (await request.get(`/${locale}/blog/`)).text();
      const m = html.match(/<p class="section-sub"[^>]*>([^<]*)<\/p>/);
      expect(m, "subtitle element").not.toBeNull();
      expect(m[1].replace(/&#39;/g, "'")).toBe(sub);
      expect(m[1]).not.toMatch(/stories from shops|Geschäften, die|dükkânlardan|店铺故事|داستان‌هایی از فروشگاه/);
    });
  }

  test("fa-ir post: date inside bdi>time[datetime], no Latin month", async ({ page }) => {
    await page.goto("/fa-ir/blog/multiple-tills-one-shop/");
    const bdi = page.locator("bdi:has(time[datetime])").first();
    await expect(bdi).toHaveCount(1);
    const s = await bdi.innerText();
    expect(s).not.toMatch(EN_MONTH);
    expect(s).not.toMatch(/[A-Za-z]/);
  });

  test("de-de fallback post keeps the English date (lang=en line)", async ({ request }) => {
    const html = await (await request.get("/de-de/blog/blog-is-live/")).text();
    const m = html.match(/<p[^>]*lang="en"[^>]*>\s*<bdi><time datetime="[^"]+">([^<]+)<\/time><\/bdi>/);
    expect(m, "fallback date line is lang=en").not.toBeNull();
    expect(m[1]).toMatch(EN_MONTH);
  });

  test("legal page: updated date is bdi>time[datetime]", async ({ request }) => {
    const html = await (await request.get("/de-de/legal/privacy/")).text();
    expect(html).toMatch(/<bdi><time datetime="\d{4}-\d{2}-\d{2}">[^<]+<\/time><\/bdi>/);
    // Fallback (English original) → English date
    expect(html.match(/<bdi><time[^>]*>([^<]+)</)[1]).toMatch(EN_MONTH);
  });
});
