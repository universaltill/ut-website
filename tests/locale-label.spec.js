// The AI label, the per-key English fallback, the language switcher and the
// English-only legal pages, for every locale in the published list (ADR-0177,
// UX spec 2026-11-04, ut-docs#5406). The expectations come from the list, so a
// locale that gains a human review (the label goes away) or a new language
// (it gets tested) needs no edit here.
import { expect, test } from "@playwright/test";
import { I18N, LOCALES, LOCALE_INFO, SOURCE, isLabelled, infoOf } from "./helpers/locales.js";

const PAGES = ["", "/download", "/find-your-setup", "/language", "/blog/", "/legal/terms/"];
const labelled = LOCALES.filter(isLabelled);

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

    test(`AI band is present exactly when the list says the locale is unreviewed (${isLabelled(locale) ? "yes" : "no"})`, async ({ page }) => {
      for (const p of PAGES) {
        await page.goto(`/${locale}${p}`);
        const band = page.locator("[data-mt-band]");
        await expect(band, p).toHaveCount(isLabelled(locale) ? 1 : 0);
        if (!isLabelled(locale)) continue;
        // Meaning is words, not colour: the label text and the detail are both in the page's language.
        await expect(band).toContainText(D["site.machine_label"]);
        await expect(band).toContainText(D["site.machine_label_detail"]);
        await expect(band).toHaveAttribute("role", "note");
        // Not an alert, not live, not a dialog; focus is not moved on load.
        await expect(page.locator('.mt-band[role="alert"], .mt-band[role="status"], .mt-band[role="dialog"], .mt-band [aria-live], .mt-band[aria-live]')).toHaveCount(0);
        if (p !== "/language") expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
        // First thing after the header, before main.
        expect(await page.evaluate(() => document.querySelector("header.nav").nextElementSibling.hasAttribute("data-mt-band"))).toBe(true);
        // The English link goes to the same page in en-gb and answers 200; the report link names the locale.
        const en = band.locator('a[hreflang="en-GB"]');
        const href = await en.getAttribute("href");
        expect(href).toBe(`/${SOURCE}${p}`);
        expect((await page.request.get(href)).status()).toBe(200);
        const report = band.locator('a[href^="mailto:support@universaltill.com"]');
        expect(decodeURIComponent(await report.getAttribute("href"))).toContain(`Translation error (${locale})`);
        await expect(band.locator("bdi")).toHaveCount(2);
      }
    });

    test(`the AI band is in the HTML with JavaScript off`, async ({ browser }) => {
      test.skip(!isLabelled(locale));
      const ctx = await browser.newContext({ javaScriptEnabled: false });
      const page = await ctx.newPage();
      await page.goto(`/${locale}/download`);
      await expect(page.locator("[data-mt-band]")).toHaveCount(1);
      await expect(page.locator(".foot-report a")).toHaveAttribute("href", /^mailto:support@universaltill\.com/);
      // The pill's accessible name already contains its visible text before any script runs.
      const pill = page.locator(".lang-link");
      const visible = (await pill.textContent()).replace("🌐", "").trim();
      expect((await pill.getAttribute("aria-label")).toLowerCase()).toContain(visible.toLowerCase());
      await ctx.close();
    });

    test(`the branded 404 shows the band too (built in the browser: one page for every locale)`, async ({ page }) => {
      test.skip(!isLabelled(locale));
      await page.goto(`/${locale}/no-such-page`);
      await expect(page.locator("[data-mt-band]")).toHaveCount(1);
      await expect(page.locator("[data-mt-band] a[hreflang='en-GB']")).toHaveAttribute("href", `/${SOURCE}`);
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
        // Badge exactly on unreviewed locales; its long form is in the accessible name.
        await expect(card.locator(".mt-badge"), l.url).toHaveCount(isLabelled(l.url) ? 1 : 0);
        if (isLabelled(l.url)) await expect(card.locator(".sr-only")).toHaveText(I18N[locale]["site.machine_label"]);
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
      for (const sel of [".locale-card", ".lang-link", ".mt-band a"]) {
        for (const el of await page.locator(sel).all()) {
          const box = await el.boundingBox();
          expect(box.height, `${p} ${sel}`).toBeGreaterThanOrEqual(43.5);
          if (sel !== ".mt-band a") expect(box.width, `${p} ${sel}`).toBeGreaterThanOrEqual(43.5);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(15);
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
