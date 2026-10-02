// ut-docs#3493 — PageSpeed "Improve image delivery" (707 KiB on desktop):
// every home-page screenshot shipped at 1600px while rendering at ~350–520
// CSS px. Screenshots now carry srcset variants (scripts/make-image-variants.sh)
// and the browser picks the smallest that fits. These checks fail if a
// variant goes missing, its width descriptor lies, or the LCP hero loses its
// priority hint.
import { expect, test } from "@playwright/test";

const WIDTHS = [480, 640, 768, 1024, 1280];

test.describe("home-page screenshots are responsive", () => {
  test("each screenshot offers the 480w–1280w ladder plus the full original whose descriptors are true", async ({ page }) => {
    await page.goto("/en-gb");
    const imgs = await page.$$eval("main img[src^='/images/'], section img[src^='/images/']", (els) =>
      els.map((el) => ({ src: el.getAttribute("src"), srcset: el.getAttribute("srcset"), sizes: el.getAttribute("sizes"), width: Number(el.getAttribute("width")) })),
    );
    expect(imgs.length).toBeGreaterThan(8);
    for (const img of imgs) {
      expect(img.src, "screenshots are WebP").toMatch(/\.webp$/);
      expect(img.srcset, `srcset on ${img.src}`).toBeTruthy();
      expect(img.sizes, `sizes on ${img.src}`).toBeTruthy();
      const candidates = img.srcset.split(",").map((c) => c.trim().split(/\s+/));
      const declared = candidates.map(([, w]) => Number(w.replace(/w$/, "")));
      expect(declared, `widths on ${img.src}`).toEqual([...WIDTHS, img.width]);
      for (const [url, w] of candidates) {
        const natural = await page.evaluate(
          (u) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i.naturalWidth); i.onerror = () => fail(new Error("load " + u)); i.src = u; }),
          url,
        );
        expect(natural, `${url} really is ${w}`).toBe(Number(w.replace(/w$/, "")));
      }
    }
  });

  test("a narrow screen downloads a small variant, not the 1600px original", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto("/en-gb");
    const hero = page.locator(".hero .hero-art img");
    await expect.poll(() => hero.evaluate((el) => el.currentSrc)).toMatch(/-480\.webp$/);
    await ctx.close();
  });

  test("the LCP hero image is fetched with high priority and not lazily", async ({ page }) => {
    await page.goto("/en-gb");
    const hero = page.locator(".hero .hero-art img");
    await expect(hero).toHaveAttribute("fetchpriority", "high");
    await expect(hero).toHaveAttribute("loading", "eager");
  });
});

test("the language link's accessible name contains its visible text (WCAG 2.5.3)", async ({ page }) => {
  await page.goto("/de-de");
  const link = page.locator(".nav-actions .lang-link");
  await expect(link).toHaveText(/DE-DE/);
  // axe ignores symbolic text (the 🌐) when matching, so compare the letters.
  const visible = (await link.textContent()).replace(/^[^\p{L}]+/u, "").trim();
  expect(await link.getAttribute("aria-label")).toContain(visible);
});

// The invariant the srcset/sizes pair exists for (ut-docs#3493 review): at
// every viewport × pixel density the browser picks a candidate at least as
// wide as the image is drawn (else it's blurry), and the next-smaller
// candidate would NOT have been enough (else bytes are wasted). A `sizes`
// that disagrees with the real CSS layout fails here.
// 412×1.75 and 1350×1 are Lighthouse/PageSpeed's mobile and desktop
// emulation (ut-docs#3516): "Properly size images" must stay clean there.
const VIEWPORTS = [[390, 1], [390, 2], [412, 1.75], [768, 1], [768, 2], [1280, 1], [1280, 2], [1350, 1], [1920, 1], [1920, 2]];
for (const [width, dpr] of VIEWPORTS) {
  test(`screenshots are sharp and not oversized at ${width}px, DPR ${dpr}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: dpr });
    const page = await ctx.newPage();
    await page.goto("/en-gb");
    const imgs = page.locator("img[srcset]");
    const n = await imgs.count();
    for (let i = 0; i < n; i++) {
      const img = imgs.nth(i);
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => img.evaluate((el) => el.complete && !!el.currentSrc)).toBe(true);
      const { src, drawn, candidates } = await img.evaluate((el) => ({
        src: el.currentSrc,
        drawn: el.getBoundingClientRect().width * devicePixelRatio,
        candidates: el.getAttribute("srcset").split(",").map((c) => {
          const [u, w] = c.trim().split(/\s+/);
          return { url: new URL(u, location.href).href, w: Number(w.replace(/w$/, "")) };
        }),
      }));
      const picked = candidates.find((c) => c.url === src);
      const largest = Math.max(...candidates.map((c) => c.w));
      expect(picked, `${src} is one of the srcset candidates`).toBeTruthy();
      // 5% slack: browsers round, and sub-pixel upscaling is invisible.
      if (picked.w !== largest) expect(picked.w, `${src} drawn at ${Math.round(drawn)}px`).toBeGreaterThanOrEqual(drawn * 0.95);
      const smaller = candidates.filter((c) => c.w < picked.w).map((c) => c.w);
      if (smaller.length) expect(Math.max(...smaller), `${src}: a smaller candidate would do for ${Math.round(drawn)}px`).toBeLessThan(drawn * 1.05);
      // The ladder is fine enough that no pick is grossly oversized
      // (PageSpeed "Properly size images", ut-docs#3516). The smallest
      // candidate is exempt: nothing smaller exists to pick.
      if (smaller.length) expect(picked.w, `${src} is ${(picked.w / drawn).toFixed(2)}× its ${Math.round(drawn)}px drawn width`).toBeLessThanOrEqual(drawn * 1.4);
    }
    await ctx.close();
  });
}

test("the language pill is already right in the raw HTML (no JS), marketing and Astro pages", async ({ request }) => {
  for (const url of ["/de-de", "/de-de/blog/", "/fa-ir/download"]) {
    const html = await (await request.get(url)).text();
    const loc = url.split("/")[1].toUpperCase();
    const pill = html.match(/<a class="lang-link"[^>]*>[^<]*<\/a>/)?.[0] ?? "";
    expect(pill, url).toContain(`>🌐 ${loc}</a>`);
    expect(pill, url).toMatch(new RegExp(`aria-label="${loc} — [^"]+"`));
  }
});

// ut-docs#3498: at ≤900px `.hero-art` was a shrink-to-fit grid item
// (margin: auto), so before its image arrived the box was ~2px wide and the
// image's arrival pushed the page down (live mobile CLS 0.25). The box must
// have its final width while the image is still in flight.
for (const width of [390, 800]) {
  test(`screenshot boxes keep their size before the image loads (${width}px)`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await page.route("**/images/**", () => {}); // never answer: images stay in flight
    await page.goto("/en-gb", { waitUntil: "domcontentloaded" });
    for (const sel of [".hero .hero-art img", "#hardware .hero-art img"]) {
      const w = await page.locator(sel).evaluate((el) => el.getBoundingClientRect().width);
      expect(w, `${sel} width before load`).toBeGreaterThan(Math.min(520, width - 64) - 1);
    }
    await ctx.close();
  });
}
