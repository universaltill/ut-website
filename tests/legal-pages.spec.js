// ut-docs#1552: Impressum, privacy policy and terms of use pages, and the
// footer links to them from every page. Only en-gb has real page content
// right now (the homelab Ollama translation endpoint is unreachable from a
// cloud pipeline session — same accepted degraded state as ut-docs#1292),
// so the other locales are checked for the honest-fallback state instead of
// a translated one. The footer LINK LABEL is a narrower exception: "foot.
// impressum" uses the bare term "Impressum" in every locale (not a
// translation — the DDG obligation's own name), so that one is checked for
// real content everywhere.
import { expect, test } from "@playwright/test";

const SLUGS = ["impressum", "privacy", "terms"];
const HOME_PAGES = ["/en-gb", "/en-gb/download", "/en-gb/start", "/en-gb/pilot", "/en-gb/store", "/en-gb/language"];

test.describe("footer legal links", () => {
  for (const path of HOME_PAGES) {
    test(`${path} footer links to Impressum, privacy and terms`, async ({ page }) => {
      await page.goto(path);
      for (const slug of SLUGS) {
        await expect(page.locator(`.foot-legal a[href="/legal/${slug}"]`)).toHaveCount(1);
      }
    });
  }

  test("/en-gb/blog (Astro-rendered) carries the same three footer links", async ({ page }) => {
    await page.goto("/en-gb/blog");
    // Locale-prefixed here (unlike the static site/*.html pages above),
    // because BaseLayout.astro routes every internal link through L() —
    // see the "stays in that locale" test below for why that matters.
    for (const slug of SLUGS) {
      await expect(page.locator(`.foot-legal a[href="/en-gb/legal/${slug}"]`)).toHaveCount(1);
    }
  });

  // Regression test for a real review finding: an earlier draft hardcoded
  // these three links unprefixed on Astro pages, so clicking "Impressum"
  // from a German or Persian page silently ejected the reader into
  // en-gb (and, on fa-ir, out of RTL) via the /legal/* 301. Every other
  // link on this page already goes through BaseLayout's L() helper for
  // exactly this reason — these three must too.
  test("on a non-English Astro page, the footer legal links stay in that locale", async ({ page }) => {
    await page.goto("/de-de/blog");
    await expect(page.locator('.foot-legal a[href="/de-de/legal/impressum"]')).toHaveCount(1);
    await expect(page.locator('.foot-legal a[href="/de-de/legal/privacy"]')).toHaveCount(1);
    await expect(page.locator('.foot-legal a[href="/de-de/legal/terms"]')).toHaveCount(1);
    // The German-language label needs no translation to be correct — see
    // the comment above.
    await expect(page.locator('.foot-legal a[href="/de-de/legal/impressum"]')).toHaveText("Impressum");
  });
});

test.describe("legal pages render", () => {
  for (const slug of SLUGS) {
    test(`/en-gb/legal/${slug} renders real content, not a fallback banner`, async ({ page }) => {
      await page.goto(`/en-gb/legal/${slug}`);
      await expect(page.locator("h1")).toBeVisible();
      // English is the source locale — it must never show the "isn't
      // translated yet" banner about itself.
      await expect(page.locator('[data-i18n="news.untranslated"]')).toHaveCount(0);
    });
  }

  test("/de-de/legal/impressum falls back to English content, honestly labelled", async ({ page }) => {
    await page.goto("/de-de/legal/impressum");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator('[data-i18n="news.untranslated"]')).toBeVisible();
    // The fallback body is forced ltr/en even though the page chrome
    // around it is de-de — same rule blog/[slug].astro already applies.
    const bodyLang = await page.locator("article div[lang]").getAttribute("lang");
    expect(bodyLang).toBe("en");
  });

  test("the Impressum names the current registered office and company number", async ({ page }) => {
    await page.goto("/en-gb/legal/impressum");
    const body = await page.locator("article").innerText();
    expect(body).toContain("82 A James Carter Road");
    expect(body).toContain("11442274");
    expect(body).toContain("support@universaltill.com");
  });
});
