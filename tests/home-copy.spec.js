// ut-docs#4203 — homepage copy, slice 1. Hero, "Why shops switch", "Free means
// free", "Switch this afternoon" and the closing call to action, in every
// locale: checked on the raw prerendered response (what a crawler sees) and in
// the rendered page. Expectations come from site/i18n.js, not typed twice.
import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const i18nSrc = fs.readFileSync(path.join(ROOT, "site/i18n.js"), "utf8");
const I18N = (0, eval)("(" + i18nSrc.match(/const I18N = (\{[\s\S]*?\});\s*\n\s*\(function/)[1] + ")");
const LOCALES = Object.keys(I18N);
const ORDER = ["hero", "why", "free", "switch", "solutions", "tour", "manage", "hardware", "plugins", "get-started", "about", "faq", "close"];
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

test("no hero promises a cancel-any-month term without 'monthly billing'", () => {
  expect(I18N["en-gb"]["hero.lede"]).toContain("on monthly billing");
  for (const l of LOCALES) expect(I18N[l]["hero.lede"], l).not.toMatch(/Cancel any month|Jeden Monat kündbar|İstediğiniz ay iptal|任意一个月都可取消|هر ماه که خواستید لغو/);
});

test("the dict has the new keys and none of the retired ones", () => {
  for (const l of LOCALES) {
    for (const k of ["free.title", "free.body", "free.pay", "free.cta", "switch.title", "switch.body", "switch.side", "switch.pro", "close.title", "close.cta", "close.talk", "why.hardware.t", "why.exit.d"]) {
      expect(I18N[l][k], `${l} ${k}`).toBeTruthy();
    }
    for (const k of ["why.contracts.t", "why.contracts.d", "why.data.t", "why.data.d"]) expect(I18N[l][k], `${l} ${k}`).toBeUndefined();
  }
});

for (const locale of LOCALES) {
  const D = I18N[locale];

  test(`${locale}: raw response carries the new home copy in order`, async ({ request }) => {
    const html = await (await request.get(`/${locale}`)).text();
    const h1 = decode(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1]);
    expect(h1).toBe(D["hero.title"]);
    const ids = [...html.matchAll(/<section\s+(?:id="([\w-]+)"\s+)?class="([^"]*)"/g)].map((m) => m[1] || (m[2].includes("hero") ? "hero" : ""));
    expect(ids.filter((i) => ORDER.includes(i))).toEqual(ORDER);
    // Scoped to the new CTAs themselves: the header's nav link alone would satisfy a bare href match.
    for (const k of ["hero.cta1", "free.cta", "close.cta"]) {
      expect(html, k).toMatch(new RegExp(`<a\\b(?=[^>]*data-i18n="${k.replace(".", "\\.")}")(?=[^>]*href="/${locale}/find-your-setup")`));
    }
    const close = html.slice(html.indexOf('<section id="close"'));
    expect(close.slice(0, close.indexOf("</section>"))).toContain('href="mailto:support@universaltill.com"');
  });

  test(`${locale}: page structure, links and wording`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await expect(page.locator("h1")).toHaveText(D["hero.title"]);
    await expect(page.locator("#why .card")).toHaveCount(4);
    for (const id of ["free", "switch", "close"]) await expect(page.locator(`#${id}`)).toHaveCount(1);
    const ids = await page.locator("main > section").evaluateAll((ss) => ss.map((s) => s.id || "hero"));
    expect(ids).toEqual(ORDER);
    for (const sel of ['a[data-i18n="free.cta"]', 'a[data-i18n="close.cta"]']) {
      await expect(page.locator(sel)).toHaveAttribute("href", `/${locale}/find-your-setup`);
    }
    await expect(page.locator('#close a[href="mailto:support@universaltill.com"]')).toHaveCount(1);
    await expect(page.locator("#close .btn.primary.big")).toHaveCount(1);
    if (locale === "de-de") {
      const why = await page.locator("#why").innerText();
      expect(why).toContain("TSE");
      // The German TSE figures are read from the vendored price file, never typed twice (plan-prices.md mirror rule).
      const tse = JSON.parse(fs.readFileSync(path.join(ROOT, "data/plan-prices.json"), "utf8")).countries.de.tse_per_main_till;
      expect(D["why.hardware.d"]).toContain(`${tse.monthly_minor / 100} € im Monat zzgl. MwSt.`);
      expect(D["why.exit.d"]).toContain(`${tse.min_months_per_activated_till} Monate Mindestlaufzeit`);
      // A free claim in Germany must name the legally required TSE (UWG §5).
      expect(D["free.pay"]).toContain("TSE");
    }
    // no horizontal overflow at phone width
    await page.setViewportSize({ width: 360, height: 740 });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(0);
  });
}

// ut-docs#5253 — a subscription is a contract (CAP code / UWG); the only term
// promise is "no minimum term on monthly billing". No key may say "no contract".
test("no dict value in any locale claims 'no contract'", () => {
  const re = /no contracts?\b|kein(e|en)? Vertr|ohne Vertrag|sözleşme yok|无合同|没有合同|بدون قرارداد/i;
  for (const l of LOCALES) for (const [k, v] of Object.entries(I18N[l])) expect(String(v), `${l} ${k}`).not.toMatch(re);
});

test("en-gb and de-de carry the monthly-billing wording; the German FAQ names the TSE", () => {
  const en = I18N["en-gb"];
  for (const k of ["faq.a2", "meta.home.desc", "start.lede"]) expect(en[k], k).toContain("no minimum term on monthly billing");
  expect(I18N["de-de"]["faq.a2"]).toContain("TSE");
  expect(I18N["de-de"]["faq.a2"]).toContain("Mindestlaufzeit");
});

test("the English fallback text in index.html and start.html equals the en-gb dict", () => {
  const en = I18N["en-gb"];
  const index = fs.readFileSync(path.join(ROOT, "site/index.html"), "utf8");
  const start = fs.readFileSync(path.join(ROOT, "site/start.html"), "utf8");
  expect(decode(index.match(/<meta name="description"[^>]*content="([^"]*)"/)[1])).toBe(en["meta.home.desc"]);
  expect(decode(index.match(/data-i18n="faq\.a2">([\s\S]*?)<\/p>/)[1])).toBe(en["faq.a2"]);
  expect(decode(start.match(/data-i18n="start\.lede">([\s\S]*?)<\/p>/)[1])).toBe(en["start.lede"]);
});
