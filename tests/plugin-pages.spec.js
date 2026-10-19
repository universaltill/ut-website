// ut-docs#4645 — /plugins is a grid of small cards (big logo, name, one-line
// tagline, type + price badges) and each plugin has its own page carrying the
// full description, screenshots, version, compatibility, permissions and the
// download action. Same pattern as the till's plugin store (ut-docs#4180).
// Checked on the raw HTML (what a crawler reads) and in the browser (layout).
import { expect, test } from "@playwright/test";
import fs from "node:fs";

const ORIGIN = "https://www.universaltill.com";
const LOCALES = ["en-gb", "tr-tr", "zh-cn", "fa-ir", "de-de"];
const SLUGS = JSON.parse(fs.readFileSync(new URL("../src/lib/plugin-list.json", import.meta.url), "utf8")).map((p) =>
  p.repo.replace(/^ut-plugin-/, ""),
);
const raw = async (request, path) => {
  const res = await request.get(path);
  expect(res.status(), path).toBe(200);
  return res.text();
};

test.describe("/plugins grid: small cards, no description, no buttons", () => {
  test("every card is one link to its plugin page", async ({ page }) => {
    await page.goto("/en-gb/plugins/");
    const cards = page.locator("a.plugin-card");
    expect(await cards.count()).toBeGreaterThan(5);
    const hrefs = await cards.evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    for (const href of hrefs) expect(href).toMatch(/^\/en-gb\/plugins\/[a-z0-9-]+\/$/);
    // No action buttons and no download links anywhere in the grid.
    await expect(page.locator("main .btn")).toHaveCount(0);
    await expect(page.locator('main a[href*="releases/latest"]')).toHaveCount(0);
  });

  test("a card has a logo, name, tagline and type + Free badges — not the full description", async ({ page }) => {
    await page.goto("/en-gb/plugins/");
    const card = page.locator('a.plugin-card[href="/en-gb/plugins/payment-sumup/"]');
    await expect(card.locator(".plugin-logo")).toBeVisible();
    await expect(card.locator("h3")).toHaveText("SumUp Card Payments");
    await expect(card.locator(".plugin-tagline")).toHaveText("Take card payments through SumUp.");
    await expect(card.locator('[data-i18n="pluginspage.kind.payment"]')).toHaveText("Payment");
    await expect(card.locator('[data-i18n="pluginspage.free"]')).toHaveText("Free");
    // The rest of the manifest description lives on the detail page only.
    await expect(card).not.toContainText("paired SumUp");
  });

  test("a plugin without an icon gets a letter mark", async ({ page }) => {
    await page.goto("/en-gb/plugins/");
    const sumup = page.locator('a.plugin-card[href="/en-gb/plugins/payment-sumup/"] .plugin-logo');
    await expect(sumup.locator("img")).toHaveCount(0);
    await expect(sumup).toHaveText("S");
  });
});

test.describe("plugin detail page", () => {
  test("carries the full description, details, permissions and the download action", async ({ page }) => {
    await page.goto("/en-gb/plugins/payment-sumup/");
    const h1 = page.locator("main h1");
    await expect(h1).toHaveText("SumUp Card Payments");
    await expect(h1).toHaveAttribute("lang", "en");
    await expect(page.locator(".plugin-description")).toContainText("paired SumUp");
    await expect(page.locator('main a[href="https://github.com/universaltill/ut-plugin-payment-sumup/releases/latest/download/latest.tar.gz"]')).toBeVisible();
    await expect(page.locator('main a[href="https://github.com/universaltill/ut-plugin-payment-sumup"]')).toBeVisible();
    await expect(page.locator(".plugin-facts")).toContainText(/\d+\.\d+\.\d+/);
    const perms = page.locator(".plugin-permissions li");
    await expect(perms.filter({ hasText: "net:api.sumup.com" })).toContainText("Connect to this internet address");
    await expect(page.locator('main a[href="/en-gb/plugins/"]')).toBeVisible();
  });

  test("a plugin with no packaged release says so instead of a download link", async ({ page }) => {
    await page.goto("/en-gb/plugins/integration-webhook/");
    await expect(page.locator('[data-i18n="pluginspage.norelease"]')).toBeVisible();
    await expect(page.locator('main a[href*="releases/latest"]')).toHaveCount(0);
  });

  // Logos and screenshots are copied into the build (src/lib/plugins.ts,
  // unit-tested in src/lib/plugins_test.mjs); every one a page shows must be
  // served from this site, as an image.
  test("every plugin picture is served from /plugin-assets/ as an image", async ({ page, request }) => {
    for (const slug of ["", ...SLUGS.map((s) => `${s}/`)]) {
      await page.goto(`/en-gb/plugins/${slug}`);
      const srcs = await page.locator("main img").evaluateAll((els) => els.map((e) => e.getAttribute("src")));
      for (const src of srcs) {
        expect(src).toMatch(/^\/plugin-assets\/[a-z0-9-]+\/(icon|screenshot-\d+)\.(png|jpg|webp)$/);
        const res = await request.get(src);
        expect(res.status(), src).toBe(200);
        expect(res.headers()["content-type"]).toMatch(/^image\/(png|jpeg|webp)$/);
      }
    }
  });

  for (const locale of LOCALES) {
    test(`${locale}: own canonical + hreflang set, chrome in the locale, manifest text ltr`, async ({ request }) => {
      const html = await raw(request, `/${locale}/plugins/payment-sumup/`);
      expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/${locale}/plugins/payment-sumup/">`);
      for (const l of LOCALES) expect(html).toContain(`href="${ORIGIN}/${l}/plugins/payment-sumup/"`);
      expect(html).toContain(`<title>SumUp Card Payments — Universal Till</title>`);
      expect(html).toMatch(/<h1[^>]*dir="ltr"[^>]*lang="en"[^>]*>SumUp Card Payments<|<h1[^>]*lang="en"[^>]*dir="ltr"[^>]*>SumUp Card Payments</);
    });
  }

  test("every plugin page is in the sitemap, in every locale", async ({ request }) => {
    const xml = await raw(request, "/sitemap.xml");
    for (const locale of LOCALES) {
      for (const slug of SLUGS) expect(xml).toContain(`<loc>${ORIGIN}/${locale}/plugins/${slug}/</loc>`);
    }
  });
});

test.describe("phone width and RTL", () => {
  for (const path of ["/fa-ir/plugins/", "/fa-ir/plugins/integration-ai/", "/de-de/plugins/", "/de-de/plugins/integration-ai/"]) {
    test(`${path} has no horizontal scroll at 360px`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 740 });
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("fa-ir detail page: page is rtl, manifest text reads ltr", async ({ page }) => {
    await page.goto("/fa-ir/plugins/payment-sumup/");
    expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
    const dir = await page.locator(".plugin-description").evaluate((el) => getComputedStyle(el).direction);
    expect(dir).toBe("ltr");
  });
});
