// The per-key English fallback, the language switcher and the
// English-only legal pages, for every locale in the published list (ADR-0177,
// UX spec 2026-11-04, ut-docs#5406). The expectations come from the list, so a
// locale that gains a human review or a new language
// (it gets tested) needs no edit here.
import { expect, test } from "@playwright/test";
import { RETIRED_AI_PHRASES } from "../scripts/lib/locales.mjs";
import { I18N, LOCALES, LOCALE_INFO, SOURCE, infoOf } from "./helpers/locales.js";

const PAGES = ["", "/download", "/find-your-setup", "/language", "/blog/", "/legal/terms/"];
// An AI badge/banner must never come back. Covers every published locale's wording.

for (const locale of LOCALES) {
  const D = I18N[locale];
  const info = infoOf(locale);

  test.describe(`${locale}`, () => {
    test(`<html lang dir> come from the list`, async ({ request }) => {
      for (const p of PAGES) {
        const html = await (await request.get(`/${locale}${p}`)).text();
        expect(html, p).toMatch(new RegExp(`<html lang="${info.bcp47}" dir="${info.dir}"`));
      }
    });

    test(`no AI / machine-translation label anywhere: no band, badge or report link (owner, 2026-11-11)`, async ({ page }) => {
      for (const p of [...PAGES, "/blog/whats-new-v0-2-70/", "/no-such-page"]) {
        await page.goto(`/${locale}${p}`);
        await expect(page.locator("[data-mt-band], .mt-badge, .foot-report"), p).toHaveCount(0);
        const text = await page.locator("body").innerText();
        for (const ph of RETIRED_AI_PHRASES) expect(text, `${p}: ${ph}`).not.toContain(ph);
      }
    });

    test(`fallback: one note, in the page's language, only when English text is really shown`, async ({ page }) => {
      for (const p of ["", "/download", "/blog/"]) {
        await page.goto(`/${locale}${p}`);
        const spans = page.locator("[data-i18n-fallback]");
        const n = await spans.count();
        const note = page.locator("[data-fallback-note]");
        if (locale === SOURCE) { expect(n).toBe(0); await expect(note).toHaveCount(0); continue; }
        if (n > 0) {
          await expect(note, p).toHaveCount(1);
          await expect(note).toHaveText(D["site.fallback_note"]);
          await expect(note).toHaveAttribute("role", "note");
          // English text is marked as English (screen reader voice, no rtl reordering).
          for (const el of await spans.all()) {
            await expect(el).toHaveAttribute("lang", "en");
            await expect(el).toHaveAttribute("dir", "ltr");
          }
        } else await expect(note, p).toHaveCount(0);
      }
    });

    test(`legal pages are the English text with the binding notice, canonical to en-gb, outside hreflang`, async ({ page }) => {
      test.skip(locale === SOURCE || info.surfaces.website.legal_approved === true, "this locale has an approved translation");
      for (const slug of ["impressum", "privacy", "terms"]) {
        await page.goto(`/${locale}/legal/${slug}/`);
        await expect(page.locator("[data-legal-english]")).toHaveText(D["site.legal_english_binding"]);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://www.universaltill.com/${SOURCE}/legal/${slug}/`);
        await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0);
        await expect(page.locator("article div[lang='en']")).toHaveCount(1);
      }
    });

    test(`no dead legal link in the footer or the cookie banner`, async ({ page, request }) => {
      for (const p of ["", "/pilot", "/blog/", "/language"]) {
        await page.goto(`/${locale}${p}`);
        const hrefs = await page.locator('.foot-legal a[href^="/"], #consent-banner a[href^="/"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
        expect(hrefs.length).toBeGreaterThanOrEqual(3);
        for (const h of hrefs) expect((await request.get(h, { maxRedirects: 0 })).status(), `${p} -> ${h}`).toBe(200);
      }
    });
  });
}

test.describe("language switcher", () => {
  for (const locale of LOCALES) {
    test(`/${locale}/language lists the published locales in list order`, async ({ page }) => {
      await page.goto(`/${locale}/language`);
      const cards = page.locator("ul#locale-grid > li > a.locale-card");
      expect(await cards.evaluateAll((as) => as.map((a) => a.getAttribute("data-code")))).toEqual(LOCALES);
      // One current language, marked in the markup and in words (not colour alone).
      await expect(page.locator('a[aria-current="true"]')).toHaveCount(1);
      await expect(page.locator('a[aria-current="true"]')).toHaveAttribute("data-code", locale);
      await expect(page.locator('a[aria-current="true"] .locale-current')).toHaveText(I18N[locale]["language.current"]);
      // The list labels itself by the page heading.
      await expect(page.locator("#locale-grid")).toHaveAttribute("aria-labelledby", "language-title");
      for (const l of LOCALE_INFO) {
        const card = page.locator(`a[data-code="${l.url}"]`);
        // Native name carries its own language; English name is marked English and ltr.
        await expect(card.locator("bdi")).toHaveAttribute("lang", l.bcp47);
        await expect(card.locator("bdi")).toHaveText(l.native_name);
        await expect(card.locator('[lang="en"][dir="ltr"]')).toHaveText(l.english_name);
        await expect(card.locator(".mt-badge"), l.url).toHaveCount(0);
        await expect(card.locator(".sr-only"), l.url).toHaveCount(0);
        await expect(card.locator(".locale-name > span:not(.locale-current)"), l.url).toHaveCount(0);
      }
      // Focus starts on the current card on this page only.
      expect(await page.evaluate(() => document.activeElement?.getAttribute("data-code"))).toBe(locale);
    });
  }

  test("tab order is the list order, and sizes meet 44px on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/de-de/language?from=%2Fdownload");
    let checked = 0;
    for (const p of ["/de-de/language?from=%2Fdownload", "/de-de/download", "/fa-ir/blog/", "/zh-cn"]) {
      await page.goto(p);
      for (const sel of [".locale-card", ".lang-link"]) {
        for (const el of await page.locator(sel).all()) {
          const box = await el.boundingBox();
          expect(box.height, `${p} ${sel}`).toBeGreaterThanOrEqual(43.5);
          expect(box.width, `${p} ${sel}`).toBeGreaterThanOrEqual(43.5);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(7);
    await page.goto("/de-de/language?from=%2Fdownload");
    const order = await page.locator(".locale-card").evaluateAll((as) => as.map((a) => a.getAttribute("data-code")));
    expect(order).toEqual(LOCALES);
    await page.locator(`a[data-code="${LOCALES[0]}"]`).focus();
    const seen = [];
    for (let i = 0; i < LOCALES.length; i++) {
      seen.push(await page.evaluate(() => document.activeElement.getAttribute("data-code")));
      await page.keyboard.press("Tab");
    }
    expect(seen).toEqual(LOCALES);
    // The page the visitor came from is carried into every card (sanitised by i18n.js).
    expect(await page.locator(".locale-card").evaluateAll((as) => as.map((a) => a.getAttribute("href")))).toEqual(LOCALES.map((l) => `/${l}/download`));
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(0);
  });
});

test.describe("scripts that must not be letter-spaced or slanted", () => {
  for (const locale of LOCALES.filter((l) => ["rtl"].includes(infoOf(l).dir) || /^(zh|ar|fa|ja|ko)/.test(l))) {
    test(`${locale}: letter-spacing is normal and nothing is uppercased or italic`, async ({ page }) => {
      await page.goto(`/${locale}`);
      const bad = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll("h1,h2,h3,p,a,span,label,strong,.locale-code")) {
          const s = getComputedStyle(el);
          if (!(s.letterSpacing === "normal" || parseFloat(s.letterSpacing) === 0)) out.push(el.tagName + " ls=" + s.letterSpacing);
          if (s.fontStyle === "italic") out.push(el.tagName + " italic");
          if (s.textTransform !== "none" && !el.classList.contains("locale-code") && /^(ar|fa)/.test(document.documentElement.lang)) out.push(el.tagName + " text-transform=" + s.textTransform);
        }
        return out.slice(0, 5);
      });
      expect(bad).toEqual([]);
    });
  }

  test("zh: a CJK face is in the stack and no web font is requested", async ({ page }) => {
    test.skip(!LOCALES.includes("zh-cn"));
    const fonts = [];
    page.on("request", (r) => { if (r.resourceType() === "font") fonts.push(r.url()); });
    await page.goto("/zh-cn");
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toMatch(/PingFang SC|Microsoft YaHei|Noto Sans (CJK )?SC/);
    expect(fonts).toEqual([]);
  });
});
