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

// ut-docs#4320 — shoppers search "EPOS", "till system", "Kassensystem", not
// only "point of sale"; the raw home page must use their words, and its FAQ
// must be machine-readable (FAQPage JSON-LD) with exactly the visible text.
test.describe("home page keywords + FAQ (ut-docs#4320)", () => {
  test("en-gb title and H1 use EPOS / till; de-de title uses Kassensystem", async ({ request }) => {
    const en = await (await request.get("/en-gb")).text();
    const title = decode(en.match(/<title[^>]*>([^<]*)<\/title>/)[1]);
    expect(title).toMatch(/EPOS/);
    expect(title).toMatch(/till/i);
    expect(decode(en.match(/<h1[^>]*>([^<]*)<\/h1>/)[1])).toMatch(/EPOS/);
    const de = await (await request.get("/de-de")).text();
    expect(decode(de.match(/<title[^>]*>([^<]*)<\/title>/)[1])).toMatch(/Kassensystem/);
  });

  for (const locale of LOCALES) {
    test(`/${locale} FAQ JSON-LD matches the visible FAQ`, async ({ request }) => {
      const html = await (await request.get(`/${locale}`)).text();
      const dict = I18N[locale];
      const visible = [...html.matchAll(/<summary[^>]*data-i18n="(faq\.q\d+)"[^>]*>([^<]*)<\/summary>\s*<p[^>]*data-i18n="(faq\.a\d+)"[^>]*>([^<]*)<\/p>/g)]
        .map((m) => ({ q: decode(m[2]), a: decode(m[4]) }));
      expect(visible.length).toBeGreaterThanOrEqual(6);
      for (const [i, v] of visible.entries()) {
        expect(v.q).toBe(dict[`faq.q${i + 1}`]);
        expect(v.a).toBe(dict[`faq.a${i + 1}`]);
      }
      const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
      const faq = blocks.filter((b) => b["@type"] === "FAQPage");
      expect(faq).toHaveLength(1);
      expect(faq[0]["@context"]).toBe("https://schema.org");
      expect(faq[0].inLanguage).toBe(bcp47(locale));
      expect(faq[0].mainEntity.map((e) => ({ q: e.name, a: e.acceptedAnswer.text }))).toEqual(visible);
      for (const e of faq[0].mainEntity) {
        expect(e["@type"]).toBe("Question");
        expect(e.acceptedAnswer["@type"]).toBe("Answer");
      }
    });
  }

  test("the download page has no FAQPage block", async ({ request }) => {
    const html = await (await request.get("/en-gb/download")).text();
    expect(html).not.toContain('"FAQPage"');
  });
});

// ut-docs#4320 review: Google cuts titles at ~60 and descriptions at ~160
// characters — the cut-off tail was exactly the "no monthly fee" hook.
test("home and download titles ≤ 60 and descriptions ≤ 160 characters in every locale", () => {
  for (const locale of LOCALES) {
    for (const page of ["home", "download"]) {
      expect([...I18N[locale][`meta.${page}.title`]].length, `${locale} meta.${page}.title`).toBeLessThanOrEqual(60);
      expect([...I18N[locale][`meta.${page}.desc`]].length, `${locale} meta.${page}.desc`).toBeLessThanOrEqual(160);
    }
  }
});
