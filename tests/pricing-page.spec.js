// /<locale>/pricing (ut-docs#4963): every price comes from data/plan-prices.json,
// is in the raw HTML (no JavaScript needed), annual billing is shown before
// monthly, and nothing is claimed that is not live today.
import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import { LOCALES, LOCALE_INFO, ENGLISH } from "./helpers/locales.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "plan-prices.json"), "utf8"));
const COUNTRY = { uk: "gb", de: "de", eu: "eurozone" };
// ut-docs#6722: the URL locale is the country; ONE market per page, none for an unpriced locale.
const MARKET_OF = { "en-gb": "uk", "de-de": "de", "el-gr": "eu", "es-es": "eu", "fr-fr": "eu", "it-it": "eu", "pt-pt": "eu" };
const marketOf = (l) => MARKET_OF[l] || null;
const amountsOf = (key) => {
  const c = DATA.countries[key];
  return [...Object.values(PLAN).flatMap((code) => [c.annual_per_month_minor[code], c.monthly_minor[code], c.monthly_minor[code] * 10]), c.extra_location.monthly_minor, c.extra_location.annual_per_month_minor];
};
const PLAN = { plus: "local_plus", shop: "shop", pro: "pro", multi: "multi_location" };
const bcp47 = (l) => LOCALE_INFO.find((x) => x.url === l).bcp47;

// The same formatting rule as the page: digits per locale, no decimals for whole amounts.
const numLocale = (l) => (l === "fa-ir" ? bcp47(l) + "-u-nu-arabext" : bcp47(l) + "-u-nu-latn");
const money = (l, cur, minor) => {
  const v = minor / 100;
  const frac = Math.round(v) === v ? 0 : 2;
  return new Intl.NumberFormat(numLocale(l), { style: "currency", currency: cur, minimumFractionDigits: frac, maximumFractionDigits: frac }).format(v).replace(/[\u00a0\u202f]/g, " ");
};
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const unescape = (s) => s.replace(/&nbsp;/g, " ");
// Intl uses no-break spaces; compare ignoring the difference.
const norm = (s) => unescape(s).replace(/[  ]/g, " ");

test.describe("/pricing: prices come from the data, in the raw HTML", () => {
  for (const locale of LOCALES) {
    test(`${locale}: 200, and every amount in the data appears exactly as computed`, async ({ request }) => {
      const res = await request.get(`/${locale}/pricing`);
      expect(res.status()).toBe(200);
      const html = await res.text();
      const body = norm(text(html));
      const mid = marketOf(locale);
      if (!mid) {
        expect(html, `${locale} has no priced market`).not.toContain("data-plan-price=\"plus\"");
        for (const key of Object.values(COUNTRY)) for (const v of amountsOf(key)) expect(body, `${locale} must show no ${key} price`).not.toContain(money(locale, DATA.countries[key].currency, v));
        expect(body).not.toMatch(/[£€]\s?\d|\d\s?[£€]|\b(GBP|EUR)\b/);
        expect(html).not.toContain("data-tse");
        expect(html).not.toContain("data-effective-from");
        expect(html).toContain("mailto:hello@universaltill.com");
        expect(html).toContain('data-plan-price="local"');
        return;
      }
      // exactly ONE market panel, and it is this locale's
      expect([...html.matchAll(/data-market="([a-z]+)"/g)].map((m) => m[1]), locale).toEqual([mid]);
      const c = DATA.countries[COUNTRY[mid]];
      const panel = html.match(/<div class="price-market" data-market=[\s\S]*?(?=<div class="price-gaps")/)[0];
      const ptext = norm(text(panel));
      for (const [p, code] of Object.entries(PLAN)) {
        expect(ptext, `${locale} ${mid} ${p} annual`).toContain(money(locale, c.currency, c.annual_per_month_minor[code]));
        expect(ptext, `${locale} ${mid} ${p} monthly`).toContain(money(locale, c.currency, c.monthly_minor[code]));
        expect(ptext, `${locale} ${mid} ${p} yearly total`).toContain(money(locale, c.currency, c.monthly_minor[code] * 10));
      }
      expect(ptext).toContain(money(locale, c.currency, c.extra_location.monthly_minor));
      expect(ptext).toContain(money(locale, c.currency, c.extra_location.annual_per_month_minor));
      if (c.tse_per_main_till) {
        expect(panel).toContain("data-tse");
        expect(ptext).toContain(money(locale, c.currency, c.tse_per_main_till.monthly_minor));
        expect(ptext).toContain(new Intl.NumberFormat(numLocale(locale)).format(c.tse_per_main_till.min_months_per_activated_till));
      } else {
        expect(html).not.toContain("data-tse");
      }
      // no other market's price is on the page (GBP vs EUR symbols never mix)
      const otherCur = c.currency === "GBP" ? "EUR" : "GBP";
      expect(body, `${locale} shows a ${otherCur} price`).not.toMatch(new RegExp(otherCur === "GBP" ? "£\\s?\\d|\\d\\s?£|GBP" : "€\\s?\\d|\\d\\s?€|EUR"));
      if (mid === "eu") for (const v of amountsOf("de")) if (!amountsOf("eurozone").includes(v)) expect(body, `${locale} shows a German-only amount`).not.toContain(money(locale, "EUR", v));
      expect(body).toContain(new Intl.DateTimeFormat(numLocale(locale), { dateStyle: "long", timeZone: "UTC" }).format(new Date(DATA.effective_from + "T00:00:00Z")).replace(/[\u00a0\u202f]/g, " "));
    });
  }

  test("en-gb: the ladder, Enterprise talk-to-us, other countries not published", async ({ request }) => {
    const html = await (await request.get("/en-gb/pricing")).text();
    const t = norm(text(html));
    for (const n of ["Local", "Local Plus", "Shop", "Pro", "Multi-location", "Enterprise and chains"]) expect(t).toContain(n);
    expect(t).toContain("excl. VAT");
    expect(t).toContain("All prices exclude VAT");
    expect(t).not.toContain("not published yet");
    expect(t).toContain("Not yet");
    expect(t).toContain("never charged per till");
    expect(html).toContain('href="/en-gb/download"');
    expect(html).toContain('href="/en-gb/find-your-setup"');
    expect(html).toContain('href="/en-gb/legal/terms/"');
    expect(html).toContain('href="/en-gb/legal/privacy/"');
    expect(html).toContain("mailto:hello@universaltill.com");
  });

  test("en-gb: annual billing is shown before monthly on every paid plan, and the UK TSE line is absent", async ({ request }) => {
    const html = await (await request.get("/en-gb/pricing")).text();
    const uk = html.match(/<div class="price-market" data-market="uk"[\s\S]*?(?=<div class="price-gaps")/)[0];
    const cards = uk.split('<article class="card price-card"').slice(1).filter((c) => /data-plan="(plus|shop|pro|multi)"/.test(c));
    expect(cards).toHaveLength(4);
    for (const c of cards) {
      expect(c.indexOf('data-billing="annual"')).toBeGreaterThan(-1);
      expect(c.indexOf('data-billing="annual"')).toBeLessThan(c.indexOf('data-billing="monthly"'));
    }
    expect(uk).not.toContain("data-tse");
    expect(uk).not.toMatch(/TSE/);
  });

  test("de-de: the German panel carries the TSE line with the 12-month minimum, as the wizard words it", async ({ request }) => {
    const html = await (await request.get("/de-de/pricing")).text();
    const de = html.match(/<div class="price-market" data-market="de"[\s\S]*?(?=<div class="price-gaps")/)[0];
    const t = norm(text(de));
    expect(t).toContain("TSE");
    expect(t).toContain(String(DATA.countries.de.tse_per_main_till.min_months_per_activated_till));
    expect(html).not.toMatch(/data-market="(uk|eu)"/);
  });
});

test.describe("/pricing: honesty", () => {
  test("no competitor names, no off-site backup claim, no certification claim, in any locale", async ({ request }) => {
    for (const locale of LOCALES) {
      const t = norm(text(await (await request.get(`/${locale}/pricing`)).text())).toLowerCase();
      for (const name of ["square", "lightspeed", "toast", "zettle", "epos now", "eposnow", "clover", "orderbird", "tillhub", "shopify pos", "revel", "vend", "booker"]) {
        expect(t, `${locale} mentions ${name}`).not.toMatch(new RegExp(`\\b${name}\\b`));
      }
      for (const m of t.matchAll(/backup/g)) expect(t.slice(m.index - 60, m.index + 80)).toContain("coming soon");
      expect(t).not.toMatch(/certified by|gobd-compliant|revisionssicher|audit-proof/);
    }
  });

  test("no amount is typed in the template or the pricing keys", async () => {
    const tpl = fs.readFileSync(path.join(ROOT, "site", "pricing.html"), "utf8");
    expect(tpl).not.toMatch(/[£€$]\s?\d/);
    expect(tpl).not.toMatch(/\d+[.,]\d\d\b/);
    for (const [k, v] of Object.entries(ENGLISH)) {
      if (!k.startsWith("pricing.") && !k.startsWith("meta.pricing.")) continue;
      expect(v, k).not.toMatch(/[£€$]\s?\d/);
      expect(v, k).not.toMatch(/\d+[.,]\d\d\b/);
    }
  });

  test("every pricing key is review: legal", async () => {
    const meta = JSON.parse(fs.readFileSync(path.join(ROOT, "i18n", "en.meta.json"), "utf8"));
    for (const k of Object.keys(meta)) {
      if (/^(meta\.)?pricing\./.test(k) && !/^pricing\.(market\.label|cta\.paid)$/.test(k)) expect(meta[k].review, k).toBe("legal");
    }
  });

  test("the only mailto is the allow-listed hello@ and no form or tracking script is on the page", async ({ request }) => {
    const html = await (await request.get("/en-gb/pricing")).text();
    const addrs = [...html.matchAll(/mailto:([^"?]+)/g)].map((m) => m[1]);
    expect(addrs.length).toBeGreaterThan(0);
    for (const a of addrs) expect(a).toBe("hello@universaltill.com");
    expect(html).not.toMatch(/<form|<input/);
  });
});

test.describe("/pricing: links and the picker", () => {
  test("every internal link on the page answers 200", async ({ request }) => {
    const html = await (await request.get("/en-gb/pricing")).text();
    const hrefs = new Set([...html.matchAll(/href="(\/[^"#?]*)"/g)].map((m) => m[1]).filter((h) => !/\.(css|svg|js)$/.test(h)));
    for (const h of hrefs) expect((await request.get(h)).status(), h).toBe(200);
  });

  test("no tabs or picker anywhere: one market per page, same with JavaScript on or off", async ({ page, browser }) => {
    for (const [locale, mid] of [["en-gb", "uk"], ["de-de", "de"], ["fr-fr", "eu"]]) {
      await page.goto(`/${locale}/pricing`);
      await expect(page.locator("[data-market]")).toHaveCount(1);
      await expect(page.locator(`[data-market="${mid}"]`)).toBeVisible();
      await expect(page.locator("[data-picker], button[data-for], .price-pick")).toHaveCount(0);
    }
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const nojs = await ctx.newPage();
    await nojs.goto("/de-de/pricing");
    await expect(nojs.locator("[data-market]")).toHaveCount(1);
    await expect(nojs.locator('[data-market="de"]')).toBeVisible();
    await ctx.close();
  });

  test("an unpriced locale shows free Local and Talk to us, no paid price", async ({ page }) => {
    for (const locale of LOCALES.filter((l) => !marketOf(l))) {
      await page.goto(`/${locale}/pricing`);
      await expect(page.locator('[data-market="none"]')).toBeVisible();
      await expect(page.locator('[data-plan-price="plus"], [data-plan-price="shop"], [data-plan-price="pro"], [data-plan-price="multi"]')).toHaveCount(0);
    }
  });

  test("Pricing is linked from the header and the footer of the home page in every locale", async ({ request }) => {
    for (const locale of LOCALES) {
      const html = await (await request.get(`/${locale}`)).text();
      expect(html).toContain(`href="/${locale}/pricing"`);
      expect((html.match(new RegExp(`href="/${locale}/pricing"`, "g")) || []).length).toBeGreaterThanOrEqual(2);
    }
  });
});
