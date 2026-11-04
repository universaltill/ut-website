// ut-docs#5355 - public help pages: /<locale>/help/ and /<locale>/help/<topic>/.
// Raw HTML (what a crawler reads) plus real Chromium for layout and the
// progressive-enhancement filter.
import { expect, test } from "@playwright/test";
import fs from "node:fs";

const ORIGIN = "https://www.universaltill.com";
const LOCALES = ["en-gb", "de-de", "tr-tr", "fa-ir", "zh-cn"];
const INDEX_TITLE = { "en-gb": "Help", "de-de": "Hilfe", "tr-tr": "Yardım", "fa-ir": "راهنما", "zh-cn": "帮助" };
const LONGEST = ["sell", "reports", "catalog"];
// What the build decided is public (src/lib/help.ts writes it); not the allow-list.
// Read lazily: the web server (which builds, and so writes it) starts first.
const publicCount = () =>
  JSON.parse(fs.readFileSync(new URL("../.help-build/manifest.json", import.meta.url), "utf8")).topics.length;
const raw = async (request, path) => {
  const res = await request.get(path);
  expect(res.status(), path).toBe(200);
  return res.text();
};
const canonicalOf = (html) => html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1];
const hreflangs = (html) => [...html.matchAll(/<link[^>]*hreflang="([^"]+)"/g)].map((m) => m[1]);

for (const locale of LOCALES) {
  test.describe(locale, () => {
    test("index renders in the locale's language and direction", async ({ page, request }) => {
      await page.goto(`/${locale}/help/`);
      await expect(page.locator("h1")).toHaveText(INDEX_TITLE[locale]);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "fa-ir" ? "rtl" : "ltr");
      expect(await page.locator("a.help-item, .help-item a").count()).toBeGreaterThan(30);
      expect(await page.locator(".help-section").count()).toBeGreaterThanOrEqual(4);
      const html = await raw(request, `/${locale}/help/`);
      expect(canonicalOf(html)).toBe(`${ORIGIN}/${locale}/help/`);
    });

    test("a topic renders: breadcrumbs, h1, summary, screenshot, body, pager", async ({ page, request }) => {
      await page.goto(`/${locale}/help/sell/`);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "fa-ir" ? "rtl" : "ltr");
      const crumbs = page.locator('nav.help-crumbs[aria-label]');
      await expect(crumbs.locator("li")).toHaveCount(3);
      await expect(crumbs.locator('[aria-current="page"]')).toHaveText(await page.locator("h1").innerText());
      await expect(crumbs.locator("a").first()).toHaveAttribute("href", `/${locale}/help/`);
      await expect(page.locator("p.help-summary")).not.toBeEmpty();
      const img = page.locator("figure.help-shot img");
      await expect(img).toHaveAttribute("width", "1024");
      await expect(img).toHaveAttribute("alt", /.+/);
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => img.evaluate((i) => i.naturalWidth)).toBeGreaterThan(0);
      await expect(page.locator(".help-body h2").first()).toBeVisible();
      const html = await raw(request, `/${locale}/help/sell/`);
      expect(html).toContain('"@type":"BreadcrumbList"');
      expect(html).not.toMatch(/keywords:|\{\{|^---$/m);
    });

    test("prev/next and related links resolve inside the locale", async ({ page, request }) => {
      await page.goto(`/${locale}/help/sell/`);
      const hrefs = await page.locator(".help-pager a, .help-more a, a.help-back").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
      expect(hrefs.length).toBeGreaterThanOrEqual(3);
      for (const href of hrefs) {
        expect(href).toMatch(new RegExp(`^/${locale}/help/`));
        expect((await request.get(href)).status(), href).toBe(200);
      }
      // sell is not the first topic by order, but the pager always has a next.
      await expect(page.locator('a.help-next[rel="next"]')).toHaveCount(1);
    });

    test("no page-level horizontal scroll at 360px (index + the longest topics)", async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 800 });
      for (const path of [`/${locale}/help/`, ...LONGEST.map((s) => `/${locale}/help/${s}/`)]) {
        await page.goto(path);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(over, path).toBeLessThanOrEqual(0);
      }
    });
  });
}

test("a table scrolls inside its wrapper and a long unbroken path never widens the page at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/en-gb/help/sell/");
  await page.evaluate(() => {
    const body = document.querySelector(".help-body");
    const cells = (tag) => Array.from({ length: 8 }, (_, i) => `<${tag}>column ${i} with some words in it</${tag}>`).join("");
    body.insertAdjacentHTML("afterbegin", `<div class="help-table"><table><thead><tr>${cells("th")}</tr></thead><tbody><tr>${cells("td")}</tr></tbody></table></div>`);
    body.insertAdjacentHTML("afterbegin", `<p><code>/opt/unitill/${"very-long-directory-name/".repeat(12)}file.txt</code></p>`);
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  expect(await page.locator(".help-table").evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
});

test.describe("untranslated topics fall back honestly (ut-docs#3811)", () => {
  // zh-cn has no help folder at all, so every topic there is the English text.
  test("zh-cn topic: notice, English content marked ltr/en, canonical to en-gb, no hreflang, not in sitemap", async ({ page, request }) => {
    await page.goto("/zh-cn/help/sell/");
    await expect(page.locator(".help-notice")).toContainText("暂无中文");
    await expect(page.locator(".help-notice")).toHaveAttribute("role", "note");
    await expect(page.locator(".help-body")).toHaveAttribute("lang", "en");
    await expect(page.locator(".help-body")).toHaveAttribute("dir", "ltr");
    const html = await raw(request, "/zh-cn/help/sell/");
    expect(canonicalOf(html)).toBe(`${ORIGIN}/en-gb/help/sell/`);
    expect(hreflangs(html)).toEqual([]);
    const sitemap = await raw(request, "/sitemap.xml");
    expect(sitemap).not.toContain(`${ORIGIN}/zh-cn/help/sell/`);
    expect(sitemap).toContain(`${ORIGIN}/zh-cn/help/</loc>`);
    expect(sitemap).toContain(`${ORIGIN}/en-gb/help/sell/</loc>`);
  });

  test("a translated topic is canonical to itself with real hreflangs only", async ({ request }) => {
    const html = await raw(request, "/de-de/help/sell/");
    expect(canonicalOf(html)).toBe(`${ORIGIN}/de-de/help/sell/`);
    const langs = hreflangs(html);
    expect(langs).toEqual(expect.arrayContaining(["en-GB", "de-DE", "tr-TR", "fa-IR", "x-default"]));
    expect(langs).not.toContain("zh-CN");
    expect(await raw(request, "/sitemap.xml")).toContain(`${ORIGIN}/de-de/help/sell/</loc>`);
  });

  test("the product's Arabic folder is not published", async ({ request }) => {
    expect((await request.get("/ar/help/")).status()).toBe(404);
    expect((await request.get("/ar-sa/help/")).status()).toBe(404);
  });
});

test.describe("index filter", () => {
  test("with JS the form is revealed and filters by title, summary and keywords", async ({ page }) => {
    await page.goto("/en-gb/help/");
    const form = page.locator("form.help-search");
    await expect(form).toBeVisible();
    const input = form.locator('input[type="search"]');
    const total = await page.locator(".help-item").count();
    await expect(page.locator(".help-count")).toContainText(String(total));
    await input.fill("voucher");
    const shown = await page.locator(".help-item:not([hidden])").count();
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(total);
    await expect(page.locator(".help-count")).toContainText(String(shown));
    // Sections left empty are hidden.
    const visibleSections = await page.locator(".help-section:not([hidden])").count();
    expect(visibleSections).toBeLessThan(await page.locator(".help-section").count());
    await input.fill("zzzzqqqq");
    await expect(page.locator(".help-item:not([hidden])")).toHaveCount(0);
    await expect(page.locator(".help-count")).toContainText("No topics match");
    await expect(page.locator(".help-clear")).toBeVisible();
    await page.locator(".help-clear").click();
    await expect(input).toHaveValue("");
    await input.fill("voucher");
    // Escape clears.
    await input.press("Escape");
    await expect(input).toHaveValue("");
    await expect(page.locator(".help-item:not([hidden])")).toHaveCount(total);
  });

  test("with JS off the search form stays hidden and every topic is listed", async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    const PUBLIC_COUNT = publicCount();
    await page.goto("/en-gb/help/");
    await expect(page.locator("form.help-search")).toBeHidden();
    expect(await page.locator(".help-item a").count()).toBe(PUBLIC_COUNT);
    await expect(page.locator(".help-item:visible")).toHaveCount(PUBLIC_COUNT);
    await ctx.close();
  });
});

test("topics the owner excluded are not published", async ({ request }) => {
  for (const slug of ["claim", "support-partner", "translate-mode", "translations", "fiscal-device", "fiscal-register"]) {
    expect((await request.get(`/en-gb/help/${slug}/`)).status(), slug).toBe(404);
  }
});

test("links to a non-public topic or a till route are plain text, not links", async ({ request }) => {
  for (const loc of LOCALES) {
    const html = await raw(request, `/${loc}/help/sell/`);
    expect(html, loc).not.toMatch(/href="\/help\//);
    expect(html, loc).not.toMatch(/href="\/(?:settings|ui|reports|refund)/);
    expect(html, loc).not.toMatch(/\/help\/(?:claim|fiscal-register|fiscal-device|support-partner|translations|translate-mode)/);
  }
});
