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

const ASTRO_PAGES = ["/en-gb/blog", "/en-gb/plugins", "/en-gb/blog/whats-new-v0-2-70"];
const LOCALES = ["en-gb", "tr-tr", "zh-cn", "fa-ir", "de-de"];

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
      const home = await headerFingerprint(page, "/en-gb");
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
      // Translated, not the English string sitting there untouched. English is
      // the one locale where "News" IS the right answer.
      if (locale === "en-gb") expect(news).toBe("News");
      else expect(news).not.toBe("News");
    });
  }

  test("every locale of a page is declared to search engines", async ({ page }) => {
    await page.goto("/en-gb/blog/whats-new-v0-2-70");
    // [hreflang] scopes this to the locale alternates specifically — the
    // page also carries an unrelated rel="alternate" RSS-autodiscovery
    // link (ut-docs#482), which has no hreflang attribute and isn't what
    // this test is about.
    const alternates = await page.evaluate(() =>
      [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => ({
        hreflang: l.getAttribute("hreflang"),
        href: l.getAttribute("href"),
      })),
    );

    // Region-tagged and correctly cased, one per locale plus x-default.
    expect(alternates.map((a) => a.hreflang).sort()).toEqual(
      ["en-GB", "fa-IR", "tr-TR", "de-DE", "x-default", "zh-CN"].sort(),
    );
    // x-default points at a real page, never at a redirect.
    expect(alternates.find((a) => a.hreflang === "x-default").href).toBe(
      "https://www.universaltill.com/en-gb/blog/whats-new-v0-2-70",
    );
    expect(alternates.find((a) => a.hreflang === "tr-TR").href).toBe(
      "https://www.universaltill.com/tr-tr/blog/whats-new-v0-2-70",
    );
  });
});

test.describe("switching language returns you to the page you were on", () => {
  test("the globe carries the current page to /language", async ({ page }) => {
    await page.goto("/en-gb/blog/whats-new-v0-2-70");
    const href = await page.locator(".lang-link").getAttribute("href");
    expect(href).toBe("/en-gb/language?from=%2Fblog%2Fwhats-new-v0-2-70");
  });

  test("the language page sends you back to that page, in the chosen language", async ({ page }) => {
    await page.goto("/en-gb/language?from=%2Fblog%2Fwhats-new-v0-2-70");

    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll(".locale-card")].map((a) => a.getAttribute("href")),
    );
    expect(hrefs).toContain("/tr-tr/blog/whats-new-v0-2-70");
    // English is prefixed too — an unprefixed URL says nothing about language,
    // which is how "switch to English" used to keep rendering Turkish.
    expect(hrefs).toContain("/en-gb/blog/whats-new-v0-2-70");

    // And the Back link, which used to be a one-way trip to the homepage.
    await expect(page.locator(".back-link a")).toHaveAttribute(
      "href",
      /\/blog\/whats-new-v0-2-70$/,
    );
  });

  test("a hostile ?from= cannot turn the picker into an open redirect", async ({ page }) => {
    await page.goto("/en-gb/language?from=%2F%2Fevil.example%2Fphish");
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll(".locale-card")].map((a) => a.getAttribute("href")),
    );
    for (const href of hrefs) {
      expect(href.startsWith("//")).toBe(false);
      expect(href).not.toContain("evil.example");
    }
  });
});

// Every URL that was live before this change must still land somewhere
// correct: the language-only prefixes were advertised in hreflang tags, and
// the unprefixed ones are what every existing link and bookmark points at.
const LEGACY = [
  ["/fa", "/fa-ir"],
  ["/tr", "/tr-tr"],
  ["/", "/en-gb"],
  ["/blog", "/en-gb/blog"],
  ["/plugins", "/en-gb/plugins"],
  ["/download", "/en-gb/download"],
];

for (const [from, to] of LEGACY) {
  test(`${from} redirects to ${to} rather than breaking`, async ({ page }) => {
    const response = await page.goto(from);
    expect(new URL(page.url()).pathname).toBe(to);
    // Permanent, so search engines move the indexing across instead of
    // treating both as live.
    const first = await response.request().redirectedFrom()?.response();
    expect(first?.status()).toBe(301);
  });
}

test("a genuinely unknown path 404s instead of answering with the homepage", async ({ page }) => {
  const response = await page.goto("/en-gb/blog/no-such-post");
  expect(response.status()).toBe(404);
});

test.describe("posts are translated, not just the chrome", () => {
  // The chrome translating while the article stays English is the state this
  // replaced, and it is easy to regress to: the page still renders, still has
  // the right <html lang>, and still looks finished.
  const SCRIPTS = {
    "tr-tr": { expect: /[çğıöşü]/i, name: "Turkish" },
    "zh-cn": { expect: /\p{Script=Han}/u, name: "Chinese" },
    "fa-ir": { expect: /\p{Script=Arabic}/u, name: "Persian" },
  };

  for (const [locale, { expect: script, name }] of Object.entries(SCRIPTS)) {
    test(`/${locale}/blog/… serves the post body in ${name}`, async ({ page }) => {
      await page.goto(`/${locale}/blog/whats-new-v0-2-70`);

      const [heading, body] = await page.evaluate(() => [
        document.querySelector("h1").textContent,
        document.querySelector("article div").textContent,
      ]);

      expect(heading).toMatch(script);
      expect(body).toMatch(script);
      // The product name is never translated, in any locale.
      expect(body).toContain("Universal Till");
      // And a machine translation says so, with a way back to the original.
      await expect(page.locator('[data-i18n="news.machine"]')).toBeVisible();
      await expect(page.locator('a[href="/en-gb/blog/whats-new-v0-2-70"]')).toBeVisible();
    });
  }

  test("every locale lists the same posts — never a shorter blog in one language", async ({ page }) => {
    const counts = {};
    for (const locale of ["en-gb", "tr-tr", "zh-cn", "fa-ir", "de-de"]) {
      await page.goto(`/${locale}/blog`);
      counts[locale] = await page.locator('a[href*="/blog/"]').count();
    }
    const values = Object.values(counts);
    expect(new Set(values).size, `post counts differ per locale: ${JSON.stringify(counts)}`).toBe(1);
  });
});
