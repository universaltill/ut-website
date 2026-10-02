// Regression tests for ut-docs#3480 — what a crawler sees WITHOUT running
// JavaScript. Before this card every locale-prefixed marketing URL served the
// same English site/*.html: `lang="en"`, English title and body, and a
// canonical pointing at a redirecting, un-prefixed URL (`/` or `/download`).
// i18n.js fixed all of it client-side, which is invisible to any crawler
// that doesn't render JS and contradicts the raw canonical for one that does.
//
// Every assertion reads the raw HTTP response (Playwright's `request`
// fixture — no browser, no script execution), and expectations are derived
// from the same sources the build reads: site/staticwebapp.config.json's
// route table and site/i18n.js's I18N dict.
import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const ORIGIN = "https://www.universaltill.com";

const i18nSrc = fs.readFileSync(path.join(ROOT, "site/i18n.js"), "utf8");
const I18N = (0, eval)("(" + i18nSrc.match(/const I18N = (\{[\s\S]*?\});\s*\n\s*\(function/)[1] + ")");
const LOCALES = Object.keys(I18N);
const bcp47 = (c) => c.split("-")[0] + "-" + c.split("-")[1].toUpperCase();

const swaConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "site/staticwebapp.config.json"), "utf8"));
// One entry per locale-prefixed marketing route: { locale, suffix, page }.
const ROUTES = swaConfig.routes
  .filter((r) => typeof r.rewrite === "string" && r.rewrite.endsWith(".html"))
  .map((r) => {
    const [, locale, rest] = r.route.match(/^\/([a-z]{2}-[a-z]{2})(\/.*)?$/) || [];
    return locale ? { locale, suffix: rest || "", page: path.basename(r.rewrite, ".html") } : null;
  })
  .filter(Boolean);
if (ROUTES.length < LOCALES.length * 4) throw new Error("route derivation looks wrong");

const isNoindex = (page) =>
  /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(fs.readFileSync(path.join(ROOT, "site", page + ".html"), "utf8"));
const metaKey = (page) => (page === "index" ? "home" : page);
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

test.describe("robots.txt", () => {
  test("is served, allows crawling, and points at the sitemap", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/plain");
    const body = await res.text();
    expect(body).toMatch(/^User-agent: \*$/m);
    expect(body).not.toMatch(/^Disallow: \/\s*$/m);
    expect(body).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });
});

test.describe("marketing pages are prerendered per locale (no JS)", () => {
  for (const { locale, suffix, page } of ROUTES) {
    const url = `/${locale}${suffix}`;
    test(`${url} (${page}.html)`, async ({ request }) => {
      const res = await request.get(url);
      expect(res.status()).toBe(200);
      const html = await res.text();
      const dict = I18N[locale];

      expect(html).toMatch(new RegExp(`<html[^>]*\\slang="${bcp47(locale)}"`));
      expect(html).toMatch(new RegExp(`<html[^>]*\\sdir="${dict._dir}"`));

      const canon = [...html.matchAll(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
      expect(canon).toEqual([`${ORIGIN}${url}`]);

      expect(decode(html.match(/<title[^>]*>([^<]*)<\/title>/)[1])).toBe(dict[`meta.${metaKey(page)}.title`]);
      expect(decode(html.match(/<meta name="description"[^>]*content="([^"]*)"/)[1])).toBe(dict[`meta.${metaKey(page)}.desc`]);

      // Body text is in this locale already: the nav's first link is on every page.
      const navKey = html.match(/data-i18n="(nav\.[a-z.]+)"/)[1];
      const navText = html.match(new RegExp(`data-i18n="${navKey.replace(/\./g, "\\.")}"[^>]*>([^<]*)<`))[1];
      expect(decode(navText)).toBe(dict[navKey]);

      const alternates = Object.fromEntries(
        [...html.matchAll(/<link[^>]*rel="alternate"[^>]*hreflang="([^"]+)"[^>]*href="([^"]+)"/g)].map((m) => [m[1], m[2]]),
      );
      if (isNoindex(page)) {
        expect(alternates).toEqual({});
      } else {
        const expected = Object.fromEntries(LOCALES.map((l) => [bcp47(l), `${ORIGIN}/${l}${suffix}`]));
        expected["x-default"] = `${ORIGIN}/en-gb${suffix}`;
        expect(alternates).toEqual(expected);
      }
    });
  }
});

test.describe("prerendered pages still switch language client-side", () => {
  test("title, meta description and text follow UT_I18N.go()", async ({ page }) => {
    await page.goto("/en-gb");
    await page.waitForFunction(() => window.UT_I18N);
    await page.evaluate(() => window.UT_I18N.go("de-de"));
    const de = I18N["de-de"];
    await expect(page).toHaveTitle(de["meta.home.title"]);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", de["meta.home.desc"]);
    await expect(page.locator("html")).toHaveAttribute("lang", "de-DE");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${ORIGIN}/de-de`);
  });

  test("data-i18n-html markup survives the prerender", async ({ request }) => {
    const html = await (await request.get("/de-de/download")).text();
    const [, key] = html.match(/data-i18n-html="([^"]+)"/) || [];
    expect(key, "download.html carries a data-i18n-html element").toBeTruthy();
    const inner = html.match(new RegExp(`data-i18n-html="${key.replace(/\./g, "\\.")}"[^>]*>([\\s\\S]*?)</span>`))?.[1];
    expect(inner).toBe(I18N["de-de"][key]);
  });
});
