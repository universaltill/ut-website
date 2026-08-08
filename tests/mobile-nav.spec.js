// Regression tests for ut-docs#458 — mobile nav language pill hidden by a
// specificity bug, and no hamburger menu at all at <=560px.
import { test, expect } from "@playwright/test";

const MOBILE_WIDTHS = [360, 560];

test.describe("mobile nav — index.html", () => {
  for (const width of MOBILE_WIDTHS) {
    test(`AC1: language pill stays visible at ${width}px without opening the menu`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/en-gb");
      await expect(page.locator(".lang-link")).toBeVisible();
    });

    test(`AC2: nav links are hidden until the toggle is opened, then close again, at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/en-gb");

      const toggle = page.locator(".nav-toggle");
      const solutions = page.locator("#site-nav a", { hasText: "Solutions" });

      await expect(toggle).toBeVisible();
      await expect(solutions).toBeHidden();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");

      // Open.
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(solutions).toBeVisible();

      // Clicking a link closes the menu.
      await solutions.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(solutions).toBeHidden();

      // Escape closes it too, and returns focus to the toggle. Focus a
      // different element first (the brand link) so this actually proves
      // Escape moves focus, rather than passing vacuously because the
      // toggle already had focus from the click above.
      await toggle.click();
      await expect(solutions).toBeVisible();
      await page.locator(".brand").focus();
      await page.keyboard.press("Escape");
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(solutions).toBeHidden();
      await expect(toggle).toBeFocused();
    });

    test(`opening the menu moves focus to its first link, at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/en-gb");
      const toggle = page.locator(".nav-toggle");
      await toggle.focus();
      await page.keyboard.press("Enter");
      // Tab order must follow what's now visually on screen: the panel's
      // links, not straight into <main> past a menu the user just opened.
      await expect(page.locator("#site-nav a").first()).toBeFocused();
    });

    test(`clicking outside the open panel closes it at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/en-gb");
      const toggle = page.locator(".nav-toggle");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      // Click near the bottom of the viewport — well outside the open
      // dropdown panel, which overlays the top of <main>.
      await page.mouse.click(5, 780);
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
    });
  }

  test("desktop layout (900px): toggle hidden, links shown inline, header stays trailing-aligned", async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await page.goto("/en-gb");
    await expect(page.locator(".nav-toggle")).toBeHidden();
    await expect(page.locator("#site-nav a", { hasText: "Solutions" })).toBeVisible();
    await expect(page.locator(".lang-link")).toBeVisible();
    // Regression guard: the nav/actions group must stay pushed to the
    // inline-end of the header, not clustered right after the brand — this
    // is exactly the layout the restructuring for ut-docs#458 could (and
    // once did, before review caught it) silently break.
    const navBox = await page.locator(".nav").boundingBox();
    const linksBox = await page.locator("#site-nav").boundingBox();
    expect(navBox).not.toBeNull();
    expect(linksBox).not.toBeNull();
    if (navBox && linksBox) {
      expect(linksBox.x + linksBox.width).toBeGreaterThan(navBox.x + navBox.width * 0.55);
    }
  });

  test("RTL: /fa-ir mobile menu opens correctly, mirrors, and stays within the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/fa-ir");

    expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");

    const toggle = page.locator(".nav-toggle");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    const panel = page.locator("#site-nav");
    await expect(panel).toBeVisible();

    const box = await panel.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    if (box && viewport) {
      // A full-bleed panel (inset-inline: 0) passes this in either
      // direction by construction — it only rules out gross overflow.
      expect(box.x).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    }

    // The direction-sensitive check: under RTL, link TEXT must hug the
    // panel's visual right edge, not the left — a physical `left:0;
    // text-align:left` "half-fix" would still pass every geometry check
    // above (review caught this: the anchor's own box is stretched full-
    // width by `align-items: stretch`, so measuring the anchor's box
    // instead of its text would pass regardless of alignment). Measure the
    // actual rendered text via Range.getBoundingClientRect(), which does
    // reflect text-align.
    const first = panel.locator("a").first();
    const textRect = await first.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      return { left: r.left, right: r.right };
    });
    if (box) {
      const gapToVisualLeft = textRect.left - box.x;
      const gapToVisualRight = (box.x + box.width) - textRect.right;
      expect(gapToVisualRight).toBeLessThan(gapToVisualLeft);
    }
  });
});

test.describe("mobile nav — smoke check on other pages", () => {
  for (const p of ["/download", "/start", "/store", "/language"]) {
    test(`toggle works on ${p}`, async ({ page }) => {
      await page.setViewportSize({ width: 400, height: 800 });
      await page.goto(p);
      const toggle = page.locator(".nav-toggle");
      await expect(toggle).toBeVisible();
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator("#site-nav")).toBeVisible();
    });
  }
});
