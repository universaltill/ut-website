// "I shouldn't understand that I am going to a different website."
//
// The Astro-built pages (/blog, /blog/*, /plugins) and the hand-written pages
// (site/*.html) are produced by completely different machinery, so they can
// drift apart with nothing failing. They had, on all three axes a visitor
// actually notices: a different body typeface (a second, Tailwind-based
// stylesheet redeclaring it), a shortened menu, and a bigger logo.
//
// These tests compare the two renderings against each other rather than
// against a hard-coded expectation — a snapshot of "correct" would just be a
// third thing to keep in sync.
import { expect, test } from "@playwright/test";

const ASTRO_PAGES = ["/blog", "/plugins", "/blog/whats-new-v0-2-70"];
const LOCALES = ["tr-tr", "zh-cn", "fa-ir"];

async function headerFingerprint(page, path) {
  await page.goto(path);
  return page.evaluate(() => {
    const link = (a) => ({
      // The href differs by design (absolute + locale-prefixed away from the
      // homepage), so compare the i18n key — which is what decides the label
      // a visitor reads.
      key: a.getAttribute("data-i18n"),
      text: a.textContent.trim(),
    });
    const logo = document.querySelector(".brand img");
    return {
      nav: [...document.querySelectorAll("#site-nav a")].map(link),
      actions: [...document.querySelectorAll(".nav-actions a")].map(link),
      logo: { width: logo.getAttribute("width"), height: logo.getAttribute("height") },
      hasToggle: !!document.querySelector(".nav-toggle"),
      font: getComputedStyle(document.body).fontFamily,
      fontSize: getComputedStyle(document.body).fontSize,
      lineHeight: getComputedStyle(document.body).lineHeight,
      footerTagline: !!document.querySelector(".foot-tagline"),
    };
  });
}

test.describe("the blog must not look like a different website", () => {
  for (const path of ASTRO_PAGES) {
    test(`${path} renders with the same chrome as the homepage`, async ({ page }) => {
      const home = await headerFingerprint(page, "/");
      const astro = await headerFingerprint(page, path);

      // Typography: the single most obvious "different site" signal.
      expect(astro.font).toBe(home.font);
      expect(astro.fontSize).toBe(home.fontSize);
      expect(astro.lineHeight).toBe(home.lineHeight);

      // Same menu, same order, same labels.
      expect(astro.nav.map((l) => l.key)).toEqual(home.nav.map((l) => l.key));
      expect(astro.nav.map((l) => l.text)).toEqual(home.nav.map((l) => l.text));
      expect(astro.actions.map((l) => l.key)).toEqual(home.actions.map((l) => l.key));

      expect(astro.logo).toEqual(home.logo);
      expect(astro.hasToggle).toBe(home.hasToggle);
      expect(astro.footerTagline).toBe(home.footerTagline);
    });
  }
});

test.describe("language lives in the URL", () => {
  for (const locale of LOCALES) {
    test(`/${locale}/blog is a real page in that language`, async ({ page }) => {
      await page.goto(`/${locale}/blog`);

      // Not a 200-with-the-homepage: this site's navigationFallback makes that
      // the default failure mode, so check the content, and check the locale
      // actually took effect rather than trusting the URL.
      await expect(page.locator("h1")).toBeVisible();
      const [lang, dir, news] = await page.evaluate(() => [
        document.documentElement.lang,
        document.documentElement.dir,
        document.querySelector('#site-nav a[data-i18n="nav.news"]').textContent.trim(),
      ]);

      expect(lang.toLowerCase()).toBe(locale);
      expect(dir).toBe(locale === "fa-ir" ? "rtl" : "ltr");
      expect(news).not.toBe("News"); // translated, not the English fallback
    });
  }

  test("every locale of a page is declared to search engines", async ({ page }) => {
    await page.goto("/blog/whats-new-v0-2-70");
    const alternates = await page.evaluate(() =>
      [...document.querySelectorAll('link[rel="alternate"]')].map((l) => ({
        hreflang: l.getAttribute("hreflang"),
        href: l.getAttribute("href"),
      })),
    );

    // Region-tagged and correctly cased, one per locale plus x-default.
    expect(alternates.map((a) => a.hreflang).sort()).toEqual(
      ["en-GB", "fa-IR", "tr-TR", "x-default", "zh-CN"].sort(),
    );
    expect(alternates.find((a) => a.hreflang === "tr-TR").href).toBe(
      "https://www.universaltill.com/tr-tr/blog/whats-new-v0-2-70",
    );
  });
});

test.describe("switching language returns you to the page you were on", () => {
  test("the globe carries the current page to /language", async ({ page }) => {
    await page.goto("/blog/whats-new-v0-2-70");
    const href = await page.locator(".lang-link").getAttribute("href");
    expect(href).toBe("/language?from=%2Fblog%2Fwhats-new-v0-2-70");
  });

  test("the language page sends you back to that page, in the chosen language", async ({ page }) => {
    await page.goto("/language?from=%2Fblog%2Fwhats-new-v0-2-70");

    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll(".locale-card")].map((a) => a.getAttribute("href")),
    );
    expect(hrefs).toContain("/tr-tr/blog/whats-new-v0-2-70");
    expect(hrefs).toContain("/blog/whats-new-v0-2-70"); // en-GB at the root

    // And the Back link, which used to be a one-way trip to the homepage.
    await expect(page.locator(".back-link a")).toHaveAttribute(
      "href",
      /\/blog\/whats-new-v0-2-70$/,
    );
  });

  test("a hostile ?from= cannot turn the picker into an open redirect", async ({ page }) => {
    await page.goto("/language?from=%2F%2Fevil.example%2Fphish");
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll(".locale-card")].map((a) => a.getAttribute("href")),
    );
    for (const href of hrefs) {
      expect(href.startsWith("//")).toBe(false);
      expect(href).not.toContain("evil.example");
    }
  });
});

test("the old language-only URLs still resolve, with a permanent redirect", async ({ page }) => {
  // /tr, /zh and /fa were live and advertised in hreflang tags before the
  // move to region-tagged locales. Breaking them would throw away whatever
  // indexing they had and 404 anyone's bookmark.
  const response = await page.goto("/fa");
  expect(response.request().redirectedFrom()?.url()).toContain("/fa");
  expect(new URL(page.url()).pathname).toBe("/fa-ir");
});
