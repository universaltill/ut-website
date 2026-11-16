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
      for (const [mid, key] of Object.entries(COUNTRY)) {
        const c = DATA.countries[key];
        const panel = html.match(new RegExp(`<div class="price-market" data-market="${mid}"[\\s\\S]*?(?=<div class="price-market" data-market=|<div class="price-other")`))[0];
        const ptext = norm(text(panel));
        for (const [p, code] of Object.entries(PLAN)) {
          expect(ptext, `${locale} ${mid} ${p} annual`).toContain(money(locale, c.currency, c.annual_per_month_minor[code]));
          expect(ptext, `${locale} ${mid} ${p} monthly`).toContain(money(locale, c.currency, c.monthly_minor[code]));
          // billed up front = ten months
          expect(ptext, `${locale} ${mid} ${p} yearly total`).toContain(money(locale, c.currency, c.monthly_minor[code] * 10));
        }
        expect(ptext).toContain(money(locale, c.currency, c.extra_location.monthly_minor));
        expect(ptext).toContain(money(locale, c.currency, c.extra_location.annual_per_month_minor));
        if (c.tse_per_main_till) {
          expect(panel).toContain("data-tse");
          expect(ptext).toContain(money(locale, c.currency, c.tse_per_main_till.monthly_minor));
          expect(ptext).toContain(new Intl.NumberFormat(numLocale(locale)).format(c.tse_per_main_till.min_months_per_activated_till));
        } else {
          expect(panel).not.toContain("data-tse");
        }
      }
      expect(body).toContain(new Intl.DateTimeFormat(numLocale(locale), { dateStyle: "long", timeZone: "UTC" }).format(new Date(DATA.effective_from + "T00:00:00Z")).replace(/[\u00a0\u202f]/g, " "));
    });
  }

  test("en-gb: the ladder, Enterprise talk-to-us, other countries not published", async ({ request }) => {
    const html = await (await request.get("/en-gb/pricing")).text();
    const t = norm(text(html));
    for (const n of ["Local", "Local Plus", "Shop", "Pro", "Multi-location", "Enterprise and chains"]) expect(t).toContain(n);
    expect(t).toContain("excl. VAT");
    expect(t).toContain("All prices exclude VAT");
    expect(t).toContain("not published yet");
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
    const uk = html.match(/<div class="price-market" data-market="uk"[\s\S]*?(?=<div class="price-market" data-market="de")/)[0];
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
    const de = html.match(/<div class="price-market" data-market="de"[\s\S]*?(?=<div class="price-market" data-market="eu")/)[0];
    const t = norm(text(de));
    expect(t).toContain("TSE");
    expect(t).toContain(String(DATA.countries.de.tse_per_main_till.min_months_per_activated_till));
    expect(html).toMatch(/data-default-market="de"/);
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

  test("with JavaScript the page opens on the locale's market and the picker switches", async ({ page }) => {
    await page.goto("/en-gb/pricing");
    await expect(page.locator('[data-market="uk"]')).toBeVisible();
    await expect(page.locator('[data-market="de"]')).toBeHidden();
    await page.locator('button[data-for="de"]').click();
    await expect(page.locator('[data-market="de"]')).toBeVisible();
    await expect(page.locator('[data-market="uk"]')).toBeHidden();
    await expect(page.locator('[data-tse]')).toBeVisible();
    await page.goto("/de-de/pricing");
    await expect(page.locator('[data-market="de"]')).toBeVisible();
  });

  test("with JavaScript off every market is shown and the picker is not", async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto("/en-gb/pricing");
    for (const m of ["uk", "de", "eu"]) await expect(page.locator(`[data-market="${m}"]`)).toBeVisible();
    await expect(page.locator("[data-picker]")).toBeHidden();
    await ctx.close();
  });

  test("Pricing is linked from the header and the footer of the home page in every locale", async ({ request }) => {
    for (const locale of LOCALES) {
      const html = await (await request.get(`/${locale}`)).text();
      expect(html).toContain(`href="/${locale}/pricing"`);
      expect((html.match(new RegExp(`href="/${locale}/pricing"`, "g")) || []).length).toBeGreaterThanOrEqual(2);
    }
  });
});
