// The Astro-rendered pages (/blog, /blog/*, /plugins) must carry the SAME
// header as the plain-HTML pages, not a lookalike.
//
// They are built from src/layouts/BaseLayout.astro while every other page is
// hand-written HTML in site/, so the two headers can drift with nothing failing
// — and the drift is invisible on a desktop. It happened already: the mobile
// hamburger added in ut-docs#458 went into site/*.html only, so on a phone the
// two newest pages on the site had no way to reach the menu at all, while
// every other page worked (ut-docs#461 AC4 called this exact risk).
//
// These tests run against dist/ — what actually deploys — not site/.
import { expect, test } from "@playwright/test";

const ASTRO_PAGES = ["/en-gb/blog", "/en-gb/plugins", "/en-gb/blog/whats-new-v0-2-70"];
const MOBILE_WIDTHS = [360, 560];

for (const path of ASTRO_PAGES) {
  test.describe(`Astro page header — ${path}`, () => {
    test("desktop: News is in the nav and points at the blog", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(path);

      const news = page.locator('#site-nav a[data-i18n="nav.news"]');
      await expect(news).toBeVisible();
      await expect(news).toHaveAttribute("href", "/en-gb/blog");
      // data-i18n is what makes the label translate; a hard-coded "News"
      // string would look right in English and stay English in tr/zh/fa.
      await expect(news).toHaveText("News");
    });

    for (const width of MOBILE_WIDTHS) {
      test(`AC1: the language pill stays visible at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(path);
        await expect(page.locator(".lang-link")).toBeVisible();
      });

      test(`AC2: the hamburger actually opens and closes the menu at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(path);

        const toggle = page.locator(".nav-toggle");
        const news = page.locator('#site-nav a[data-i18n="nav.news"]');

        // The button existing is not the test — before this fix the markup
        // could have been present with nav.js never loaded, giving a toggle
        // that does nothing. Assert the panel really opens.
        await expect(toggle).toBeVisible();
        await expect(news).toBeHidden();
        await expect(toggle).toHaveAttribute("aria-expanded", "false");

        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-expanded", "true");
        await expect(news).toBeVisible();

        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await expect(news).toBeHidden();
      });
    }
  });
}

test("the blog lists the release post, and the post renders its body", async ({ page }) => {
  await page.goto("/en-gb/blog");
  const link = page.locator('a[href*="whats-new-v0-2-70"]').first();
  await expect(link).toBeVisible();

  await page.goto("/en-gb/blog/whats-new-v0-2-70");
  // Body text, not just a 200: this site's navigationFallback has repeatedly
  // made a missing page look present, and a build that dropped MDX rendering
  // would still serve a page with a title.
  await expect(page.locator("article")).toContainText("self-order kiosk");
});
