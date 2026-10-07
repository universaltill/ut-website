// ut-docs#3809: an unknown URL answers 404 with the site's own page, not
// Azure's unbranded "Azure Static Web Apps - 404: Not found". Search Console
// found /downloads/ that way — it is not a page, only the folder the
// per-installer redirects live under, so it now 301s to the download page.
//
// The 404 page is one file for every path (SWA's responseOverrides has no
// per-locale form), so it is localised in the browser: i18n.js reads the
// locale from the URL and moves the page's /en-gb links to it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const i18nSrc = fs.readFileSync(path.join(ROOT, "site/i18n.js"), "utf8");
const I18N = (0, eval)("(" + i18nSrc.match(/const I18N = (\{[\s\S]*?\});\s*\n\s*\(function/)[1] + ")");
const LOCALES = Object.keys(I18N);

test.describe("branded 404 (ut-docs#3809)", () => {
  for (const p of ["/no-such-page", "/downloads/nothing-here.exe", "/en-gb/no-such-page/"]) {
    test(`${p} answers 404 with the site's page, noindex`, async ({ request }) => {
      const res = await request.get(p, { maxRedirects: 0 });
      expect(res.status()).toBe(404);
      const html = await res.text();
      expect(html).toContain('class="brand"');
      expect(html).toMatch(/<meta name="robots" content="noindex">/);
      expect(html).not.toMatch(/rel="canonical"|hreflang=/);
      expect(html).not.toContain("Azure Static Web Apps");
    });
  }

  for (const locale of LOCALES) {
    test(`/${locale}/… shows the 404 in ${locale}, links stay in ${locale}`, async ({ page }) => {
      expect(I18N[locale]["nf.title"], `nf.title missing from ${locale}`).toBeTruthy();
      const res = await page.goto(`/${locale}/no-such-page`);
      expect(res.status()).toBe(404);
      await expect(page.locator("h1")).toHaveText(I18N[locale]["nf.title"]);
      await expect(page.locator("html")).toHaveAttribute("dir", I18N[locale]._dir);
      await expect(page.locator("main a.btn.primary")).toHaveAttribute("href", `/${locale}`);
      await expect(page.locator("main a.btn.ghost")).toHaveAttribute("href", `/${locale}/download`);
      await expect(page.locator(".brand")).toHaveAttribute("href", `/${locale}`);
      await expect(page).toHaveTitle(I18N[locale]["meta.nf.title"]);
    });
  }

  test("an unprefixed unknown URL follows the visitor's remembered language", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("ut_lang", "tr-tr"));
    const res = await page.goto("/no-such-page");
    expect(res.status()).toBe(404);
    await expect(page.locator("h1")).toHaveText(I18N["tr-tr"]["nf.title"]);
    await expect(page.locator("main a.btn.ghost")).toHaveAttribute("href", "/tr-tr/download");
  });

  test("an unprefixed unknown URL is English for a new English-browser visitor", async ({ page }) => {
    const res = await page.goto("/no-such-page");
    expect(res.status()).toBe(404);
    await expect(page.locator("h1")).toHaveText(I18N["en-gb"]["nf.title"]);
    await expect(page.locator("main a.btn.primary")).toHaveAttribute("href", "/en-gb");
  });

  test("every link on the 404 page answers 200 directly", async ({ page, request }) => {
    await page.goto("/de-de/no-such-page");
    const hrefs = await page.locator("a[href^='/']").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(hrefs.length).toBeGreaterThan(3);
    for (const href of new Set(hrefs)) {
      const res = await request.get(href, { maxRedirects: 0 });
      expect(res.status(), href).toBe(200);
    }
  });

  for (const p of ["/downloads", "/downloads/"]) {
    test(`${p} 301s to /en-gb/download`, async ({ request }) => {
      const res = await request.get(p, { maxRedirects: 0 });
      expect(res.status()).toBe(301);
      expect(res.headers()["location"]).toBe("/en-gb/download");
    });
  }

  // href/src/action attributes and fetch() calls. Not a bare string match:
  // download.html builds "/downloads/" + <installer> on purpose, and
  // scripts/download-redirects.sh must name the folder.
  test("no shipped file references the bare /downloads/ folder", () => {
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(d, e.name)) : /\.(html|astro|ts|mdx|js)$/.test(e.name) ? [path.join(d, e.name)] : []);
    const hits = [...walk(path.join(ROOT, "site")), ...walk(path.join(ROOT, "src"))].filter((f) =>
      /(?:\b(?:href|src|action)=|\bfetch\(\s*)["'`](?:https?:\/\/(?:www\.)?universaltill\.com)?\/downloads\/?["'`#?]/.test(fs.readFileSync(f, "utf8")));
    expect(hits.map((f) => path.relative(ROOT, f))).toEqual([]);
  });
});
