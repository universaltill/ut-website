// ut-docs#4193 — the "Find your setup" wizard, driven in a real browser in
// every locale: reachable from the home page and the nav, the free-app outcome
// lands on the download page, the cloud outcome goes to my.universaltill.com in
// the visitor's locale, no broken links, nothing sent anywhere.
import { expect, test } from "@playwright/test";

const LOCALES = ["en-gb", "tr-tr", "zh-cn", "fa-ir", "de-de"];
// my.universaltill.com has no zh-cn tree (ut-my-shop/src/i18n/i18n.ts): that locale links to en-gb.
const MY_SERVED = ["en-gb", "en-us", "de-de", "es-es", "fr-fr", "it-it", "pt-pt", "tr-tr", "ar-sa", "fa-ir"];
const MY = (l) => `https://my.universaltill.com/${MY_SERVED.includes(l) ? l : "en-gb"}/`;

async function answer(page, picks = {}) {
  // picks: { biz: "cafe", needs: ["remote"], ... }; unspecified questions are skipped.
  for (const q of ["biz", "country", "sites", "needs", "card", "hardware"]) {
    await expect(page.locator(".wiz-fs input").first()).toBeVisible();
    const want = [].concat(picks[q] || []);
    for (const v of want) await page.locator(`#wiz-${q}-${v}`).check();
    await page.locator(".wiz-actions button[type=submit]").click();
  }
  await expect(page.locator(".wiz-result")).toBeVisible();
}

for (const locale of LOCALES) {
  test.describe(locale, () => {
    test("the wizard is one click from the home page hero and the main nav", async ({ page }) => {
      await page.goto(`/${locale}`);
      const hero = page.locator('.hero .cta a[data-i18n="hero.cta1"]');
      await expect(hero).toBeVisible();
      await expect(hero).toHaveAttribute("href", `/${locale}/find-your-setup`);
      await expect(page.locator('.nav a[data-i18n="nav.get"], .nav a[data-i18n="nav.start"]')).toHaveAttribute("href", `/${locale}/find-your-setup`);
      await hero.click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/find-your-setup$`));
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator(".wiz-legend")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "fa-ir" ? "rtl" : "ltr");
    });

    test("free-app outcome goes to the download page", async ({ page }) => {
      await page.goto(`/${locale}/find-your-setup`);
      await answer(page, { biz: "cafe", country: "uk", sites: "one", needs: ["tables"], hardware: "have" });
      const result = page.locator(".wiz-result");
      await expect(result).toHaveAttribute("data-route", "download");
      await expect(result).toHaveAttribute("data-plan", "local");
      await result.locator("a.wiz-go").click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/download$`));
    });

    test("cloud outcome goes to my.universaltill.com in the visitor's locale", async ({ page }) => {
      await page.goto(`/${locale}/find-your-setup`);
      await answer(page, { biz: "retail", country: "uk", sites: "one", needs: ["remote"] });
      const result = page.locator(".wiz-result");
      await expect(result).toHaveAttribute("data-route", "cloud");
      await expect(result).toHaveAttribute("data-plan", "plus");
      const go = result.locator("a.wiz-go");
      await expect(go).toHaveAttribute("href", MY(locale));
      // Follow it for real, but answer the external request locally.
      await page.route("https://my.universaltill.com/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>my</title>" }));
      await go.click();
      await expect(page).toHaveURL(MY(locale));
    });

    test("without JavaScript the two plain links remain", async ({ browser }) => {
      const ctx = await browser.newContext({ javaScriptEnabled: false });
      const page = await ctx.newPage();
      await page.goto(`/${locale}/find-your-setup`);
      await expect(page.locator('a.wiz-link[href="/' + locale + '/download"]')).toBeVisible();
      await expect(page.locator("a.wiz-link[data-my-link]")).toHaveAttribute("href", MY(locale));
      await expect(page.locator(".wiz-nojs")).toBeVisible();
      await ctx.close();
    });

    test("every link on every outcome answers 200, and nothing is sent anywhere", async ({ page, request }) => {
      const sent = [];
      page.on("request", (r) => {
        const u = new URL(r.url());
        if (u.hostname !== "localhost" || r.method() !== "GET") sent.push(`${r.method()} ${r.url()}`);
      });
      await page.goto(`/${locale}/find-your-setup`);
      await answer(page, { biz: "salon", country: "de", sites: "one", needs: ["appointments", "fiscal", "online"], card: "sumup", hardware: "need" });
      const hrefs = await page.locator(".wiz-result a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
      expect(hrefs.length).toBeGreaterThan(5);
      for (const h of hrefs) {
        if (h.startsWith("mailto:") || h.startsWith("https://my.universaltill.com/")) continue;
        expect(h, "internal links are locale-prefixed").toMatch(new RegExp(`^/${locale}/`));
        const res = await request.get(h, { maxRedirects: 0 });
        expect(res.status(), h).toBe(200);
      }
      expect(await page.locator(".wiz-gaps li").count()).toBeGreaterThan(0);
      expect(sent).toEqual([]);
      // Nothing stored either.
      expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => /wiz|answer/i.test(k)))).toEqual([]);
      expect(await page.evaluate(() => location.search + location.hash)).toBe("");
    });

    test("Back and Start over work", async ({ page }) => {
      await page.goto(`/${locale}/find-your-setup`);
      await expect(page.locator(".wiz-legend")).toBeVisible();
      await page.locator("#wiz-biz-cafe").check();
      await page.locator(".wiz-actions button[type=submit]").click();
      await expect(page.locator("#wiz-country-uk")).toBeVisible();
      await page.locator(".wiz-actions button[type=button]").click(); // Back
      await expect(page.locator("#wiz-biz-cafe")).toBeChecked(); // answer kept
      await page.locator(".wiz-actions button[type=submit]").click();
      for (let i = 0; i < 5; i++) await page.locator(".wiz-actions button[type=submit]").click();
      await expect(page.locator(".wiz-result")).toBeVisible();
      await page.locator(".wiz-actions button[type=button]").nth(1).click(); // Start over
      await expect(page.locator("#wiz-biz-cafe")).not.toBeChecked();
    });
  });
}

test("a paid plan with the country skipped asks for the country, not 'not published'", async ({ page }) => {
  await page.goto("/en-gb/find-your-setup");
  await answer(page, { needs: ["remote"] });
  await expect(page.locator(".wiz-price-main")).toHaveText("Pick your country to see the price.");
});

test("Germany + Local Plus: price excl. VAT and no managed-TSE line; the TSE-law note is there", async ({ page }) => {
  await page.goto("/en-gb/find-your-setup");
  await answer(page, { country: "de", needs: ["remote"] });
  await expect(page.locator(".wiz-result")).toHaveAttribute("data-plan", "plus");
  await expect(page.locator(".wiz-price p")).toHaveCount(2); // monthly + annual, no TSE line
  await expect(page.locator(".wiz-price-main")).toHaveText("€10 per month, excl. VAT");
  await expect(page.locator(".wiz-price-sub")).toHaveText("Or €8.33 per month when billed annually (two months free).");
  await expect(page.locator(".wiz-result")).toContainText("German law requires every business to have a TSE");
});

test("Germany + Shop with fiscal: managed-TSE line excl. VAT", async ({ page }) => {
  await page.goto("/en-gb/find-your-setup");
  await answer(page, { country: "de", needs: ["fiscal"] });
  await expect(page.locator(".wiz-price-main")).toHaveText("€29 per month, excl. VAT");
  await expect(page.locator(".wiz-price-sub").nth(0)).toHaveText("Or €24.17 per month when billed annually (two months free).");
  await expect(page.locator(".wiz-price-sub").nth(1)).toHaveText("Plus €12 per month, excl. VAT, for each main till (managed fiscal device). Not discounted, also on annual billing.");
});

test("another euro country + fiscal: honest gap, no claim about the law", async ({ page }) => {
  await page.goto("/en-gb/find-your-setup");
  await answer(page, { country: "eu", needs: ["fiscal"] });
  await expect(page.locator(".wiz-gaps")).toContainText("Check what your country requires");
  await expect(page.locator(".wiz-result")).not.toContainText("No fiscal device is required");
});

test("each question's hint is tied to its fieldset and step changes are announced politely", async ({ page }) => {
  await page.goto("/en-gb/find-your-setup");
  await expect(page.locator(".wiz-fs")).toHaveAttribute("aria-describedby", "wiz-hint-biz");
  await expect(page.locator("#wiz-hint-biz")).toBeVisible();
  const live = page.locator('[aria-live="polite"]');
  await expect(live).toHaveText("");
  await page.locator(".wiz-actions button[type=submit]").click();
  await expect(live).toContainText("Step 2 of 6");
  await expect(page.locator(".wiz-legend")).toBeFocused();
});

test("fa result: the price line uses one digit system (Persian digits)", async ({ page }) => {
  await page.goto("/fa-ir/find-your-setup");
  await answer(page, { country: "uk", needs: ["remote"] });
  const main = await page.locator(".wiz-price-main").textContent();
  expect(main).toMatch(/[۰-۹]/);
  expect(main).not.toMatch(/[0-9]/);
});

test("keyboard only: tab to an option, space to pick, enter to continue", async ({ page }) => {
  await page.goto("/en-gb/find-your-setup");
  await page.locator("#wiz-biz-cafe").focus();
  await page.keyboard.press("Space");
  await expect(page.locator("#wiz-biz-cafe")).toBeChecked();
  await page.keyboard.press("Enter");
  await expect(page.locator("#wiz-country-uk")).toBeVisible();
  // focus moved to the new question, not left on a removed node
  await expect(page.locator(".wiz-legend")).toBeFocused();
});

test("controls are at least 44px and the page does not scroll sideways at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/de-de/find-your-setup"); // longest locale
  for (const sel of [".wiz-opt", ".wiz-actions button"]) {
    for (const box of await page.locator(sel).evaluateAll((es) => es.map((e) => e.getBoundingClientRect().height))) expect(box).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const [name, size] of [["phone 360px", { width: 360, height: 740 }], ["desktop", { width: 1280, height: 800 }]]) {
  test(`drawing the first question causes no layout shift (${name})`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/de-de/find-your-setup");
    await expect(page.locator(".wiz-legend")).toBeVisible();
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.__cls)).toBeLessThan(0.01);
  });
}

test("the wizard is in the sitemap and the old unprefixed URLs redirect", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  for (const l of LOCALES) expect(xml).toContain(`/${l}/find-your-setup`);
  const r = await request.get("/find-your-setup", { maxRedirects: 0 });
  expect(r.status()).toBe(301);
  expect(r.headers()["location"]).toContain("/en-gb/find-your-setup");
});

test("German view: the same ladder in EUR and the +EUR 12 TSE line, in German", async ({ page }) => {
  await page.goto("/de-de/find-your-setup");
  await answer(page, { country: "de", needs: ["fiscal"] });
  const t = (await page.locator(".wiz-price").innerText()).replace(/\u00a0/g, " ");
  expect(t).toContain("29 € pro Monat zzgl. MwSt.");
  expect(t).toContain("24,17 €");
  expect(t).toContain("12 € pro Monat zzgl. MwSt. für jede Haupt-Kasse");
});

test("Multi-location shows 120 / 100.00 annual / extra 33 / 3 included / up to 10", async ({ page }) => {
  await page.goto("/en-gb/find-your-setup");
  await answer(page, { country: "uk", sites: "few" });
  const t = await page.locator(".wiz-price").innerText();
  expect(t).toContain("£120 per month, excl. VAT");
  expect(t).toContain("£100 per month when billed annually");
  expect(t).toContain("Includes 3 locations. Each extra location (up to 10 in total) is £33 per month");
});

test("Persian view uses Persian digits and stays RTL", async ({ page }) => {
  await page.goto("/fa-ir/find-your-setup");
  await answer(page, { country: "uk", sites: "few" });
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const t = await page.locator(".wiz-price").innerText();
  expect(t).toMatch(/[۰-۹]{3}/);
  expect(t).not.toMatch(/\d/);
});

// ut-docs#4193: "Talk to us" opens the visitor's own mail app with the answers
// filled in. The page itself still sends nothing.
for (const [locale, bizLabel, ntLabel] of [["en-gb", "Café or takeaway", "Tables and a kitchen screen"], ["zh-cn", null, null], ["fa-ir", null, null]]) {
  test(`Talk to us carries the answers into the mailto body (${locale})`, async ({ page }) => {
    const sent = [];
    page.on("request", (r) => { const u = new URL(r.url()); if (u.hostname !== "localhost" || r.method() !== "GET") sent.push(`${r.method()} ${r.url()}`); });
    await page.goto(`/${locale}/find-your-setup`);
    // Read the labels the visitor is shown, rather than hard-coding them.
    await page.locator("#wiz-biz-cafe").check();
    const cafe = (await page.locator("label[for=wiz-biz-cafe]").innerText()).trim();
    if (bizLabel) expect(cafe).toBe(bizLabel);
    await page.locator(".wiz-actions button[type=submit]").click();
    await page.locator("#wiz-country-de").check();
    await page.locator(".wiz-actions button[type=submit]").click();
    await page.locator(".wiz-actions button[type=submit]").click(); // sites skipped
    const tables = (await page.locator("label[for=wiz-needs-tables]").innerText()).trim();
    const stock = (await page.locator("label[for=wiz-needs-stock]").innerText()).trim();
    await page.locator("#wiz-needs-tables").check();
    await page.locator("#wiz-needs-stock").check();
    await page.locator(".wiz-actions button[type=submit]").click();
    await page.locator("#wiz-card-sumup").check();
    await page.locator(".wiz-actions button[type=submit]").click();
    await page.locator(".wiz-actions button[type=submit]").click(); // hardware skipped
    await expect(page.locator(".wiz-result")).toBeVisible();
    if (ntLabel) expect(tables).toContain(ntLabel);

    const hrefs = await page.locator(".wiz-result a[href^='mailto:']").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href.startsWith("mailto:support@universaltill.com?subject=")).toBe(true);
      const q = new URLSearchParams(href.slice(href.indexOf("?") + 1));
      expect(q.get("subject")).toBeTruthy();
      const body = q.get("body");
      expect(body).toContain("\r\n");
      expect(body).toContain(cafe);
      expect(body).toContain(`${tables}, ${stock}`);
      expect(body).toContain("ref: biz=cafe; country=de; needs=tables,stock; card=sumup; plan=");
      expect(body).not.toContain("sites=");
      expect(body).not.toContain("hardware=");
      expect(href).not.toMatch(/[\r\n ]/); // fully encoded
    }
    await expect(page.locator(".wiz-note")).toBeVisible();
    await expect(page.locator(".wiz-note")).not.toHaveText("wiz.talk.note");
    if (locale === "en-gb") {
      await expect(page.locator(".wiz-note")).toHaveText("“Talk to us” opens your own email app with your answers filled in. Nothing is sent unless you send that email.");
    }
    expect(sent).toEqual([]);
    expect(await page.evaluate(() => Object.keys(localStorage).concat(document.cookie.split(";")).filter((k) => /wiz|answer|biz|ref:/i.test(k)))).toEqual([]);
    expect(await page.evaluate(() => location.search + location.hash)).toBe("");
  });
}

const ALL_NEEDS = ["tables", "stock", "online", "appointments", "fiscal", "remote", "team"];

test("fa-ir worst case: the Talk to us href stays within 1800 chars and keeps the ref line", async ({ page }) => {
  await page.goto("/fa-ir/find-your-setup");
  await answer(page, { biz: "cafe", country: "de", sites: "one", needs: ALL_NEEDS, card: "sumup", hardware: "have" });
  const hrefs = await page.locator(".wiz-result a[href^='mailto:']").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const h of hrefs) {
    expect(h.length).toBeLessThanOrEqual(1800);
    expect(decodeURIComponent(h)).toContain("ref: biz=cafe; country=de; sites=one; needs=" + ALL_NEEDS.join(",") + "; card=sumup; hardware=have; plan=");
  }
});

test("enterprise route: the primary Talk to us button carries the body", async ({ page }) => {
  await page.goto("/en-gb/find-your-setup");
  await answer(page, { biz: "retail", country: "uk", sites: "huge" });
  const result = page.locator(".wiz-result");
  await expect(result).toHaveAttribute("data-route", "talk");
  const href = await result.locator("a.wiz-go").getAttribute("href");
  expect(href.startsWith("mailto:support@universaltill.com?subject=")).toBe(true);
  const body = new URLSearchParams(href.slice(href.indexOf("?") + 1)).get("body");
  expect(body).toContain("ref: biz=retail; country=uk; sites=huge; plan=enterprise");
});

test("editing an answer after a result updates the Talk to us body", async ({ page }) => {
  await page.goto("/en-gb/find-your-setup");
  await answer(page, { biz: "cafe", country: "uk", sites: "one" });
  const bodyOf = async () => {
    const h = await page.locator(".wiz-result a[href^='mailto:']").first().getAttribute("href");
    return new URLSearchParams(h.slice(h.indexOf("?") + 1)).get("body");
  };
  expect(await bodyOf()).toContain("biz=cafe; country=uk; sites=one; plan=local");
  await page.locator(".wiz-actions button[type=button]").first().click(); // Edit answers
  await page.locator("#wiz-biz-salon").check();
  for (let i = 0; i < 6; i++) await page.locator(".wiz-actions button[type=submit]").click();
  await expect(page.locator(".wiz-result")).toBeVisible();
  const b = await bodyOf();
  expect(b).toContain("biz=salon; country=uk; sites=one; plan=local");
  expect(b).not.toContain("biz=cafe");
});
