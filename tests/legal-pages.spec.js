import { I18N } from "./helpers/locales.js";
// ut-docs#1552: Impressum, privacy policy and terms of use pages, and the
// footer links to them from every page. Only en-gb has real page content
// right now (the pipeline's own-model translation workflow only targets
// src/content/blog/ so far, not this collection — same accepted degraded
// state as ut-docs#1292), so the other locales are checked for the
// honest-fallback state instead of a translated one. The footer LINK LABEL
// is a narrower exception: "foot.
// impressum" uses the bare term "Impressum" in every locale (not a
// translation — the DDG obligation's own name), so that one is checked for
// real content everywhere.
import { expect, test } from "@playwright/test";

const SLUGS = ["impressum", "privacy", "terms"];
const HOME_PAGES = ["/en-gb", "/en-gb/download", "/en-gb/start", "/en-gb/pilot", "/en-gb/language"];

test.describe("footer legal links", () => {
  for (const path of HOME_PAGES) {
    test(`${path} footer links to Impressum, privacy and terms`, async ({ page }) => {
      await page.goto(path);
      for (const slug of SLUGS) {
        await expect(page.locator(`.foot-legal a[href="/en-gb/legal/${slug}/"]`)).toHaveCount(1);
      }
    });
  }

  test("/en-gb/blog (Astro-rendered) carries the same three footer links", async ({ page }) => {
    await page.goto("/en-gb/blog");
    // Locale-prefixed here (unlike the static site/*.html pages above),
    // because BaseLayout.astro routes every internal link through L() —
    // see the "stays in that locale" test below for why that matters.
    for (const slug of SLUGS) {
      await expect(page.locator(`.foot-legal a[href="/en-gb/legal/${slug}/"]`)).toHaveCount(1);
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
    await expect(page.locator('.foot-legal a[href="/de-de/legal/impressum/"]')).toHaveCount(1);
    await expect(page.locator('.foot-legal a[href="/de-de/legal/privacy/"]')).toHaveCount(1);
    await expect(page.locator('.foot-legal a[href="/de-de/legal/terms/"]')).toHaveCount(1);
    // The label is the published list's text (legal-tier: English until a human approves it).
    await expect(page.locator('.foot-legal a[href="/de-de/legal/impressum/"]')).toHaveText(I18N["de-de"]["foot.impressum"]);
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
    // In the visitor's language: English is the binding version (ADR-0177 section 7).
    await expect(page.locator("[data-legal-english]")).toBeVisible();
    await expect(page.locator("[data-legal-english]")).toHaveText(I18N["de-de"]["site.legal_english_binding"]);
    await expect(page.locator("[data-legal-english]")).toHaveAttribute("role", "note");
    // The fallback body is forced ltr/en even though the page chrome
    // around it is de-de — same rule blog/[slug].astro already applies.
    const bodyLang = await page.locator("article div[lang]").getAttribute("lang");
    expect(bodyLang).toBe("en");
    // ut-docs#3268: the fallback must carry the same fix as en-gb, not a
    // stale pre-fallback copy.
    const body = await page.locator("article").innerText();
    expect(body).toContain("Farsid Mirza");
  });

  test("the Impressum names the current registered office and company number", async ({ page }) => {
    await page.goto("/en-gb/legal/impressum");
    const body = await page.locator("article").innerText();
    expect(body).toContain("82 A James Carter Road");
    expect(body).toContain("11442274");
    expect(body).toContain("support@universaltill.com");
    // ut-docs#1553 item 4 / ut-docs#3268: the owner-approved authorised
    // representative name, correctly spelled (a prior pass shipped
    // "Farsid", missing the h).
    expect(body).toContain("Farsid Mirza");
  });
});

// ut-docs#6063: the live-payments legal pack (Fable 5.2 review record, section 6).
test.describe("live-payments legal pages", () => {
  test("/en-gb/legal/subscription-terms/ loads with the registered office and version", async ({ page }) => {
    await page.goto("/en-gb/legal/subscription-terms/");
    await expect(page.locator("h1")).toHaveText("Subscription Terms (United Kingdom)");
    const body = await page.locator("article").innerText();
    expect(body).toContain("Version 1.0");
    expect(body).toContain("82 A James Carter Road");
    expect(body).toContain("11442274");
    expect(body).not.toContain("we email you a copy");
    expect(body).not.toMatch(/\[(VERSION|DATE|REGISTERED OFFICE|OWNER DECISION)/);
  });

  test("/en-gb/legal/refunds/ loads, with no yearly-renewal refund window", async ({ page }) => {
    await page.goto("/en-gb/legal/refunds/");
    await expect(page.locator("h1")).toHaveText("Refund and Cancellation Policy (United Kingdom)");
    await expect(page.locator("h2", { hasText: "14-day money-back on your first payment" })).toBeVisible();
    const body = await page.locator("article").innerText();
    expect(body).toMatch(/t refund renewals/);
    expect(body).not.toMatch(/after (each|every) (yearly )?renewal/i);
  });

  test("the terms and privacy pages point at them, and privacy has the billing section", async ({ page }) => {
    await page.goto("/en-gb/legal/terms/");
    await expect(page.locator('article a[href="/en-gb/legal/subscription-terms/"]')).toHaveCount(1);
    await expect(page.locator('article a[href="/en-gb/legal/refunds/"]')).toHaveCount(1);
    await page.goto("/en-gb/legal/privacy/");
    await expect(page.locator("h2", { hasText: "Billing and payments" })).toBeVisible();
    const privacy = await page.locator("article").innerText();
    expect(privacy).toContain("IP address");
    // UK GDPR Art. 13(2)(ca), in force 2026-06-19: the right to complain to the controller (ut-docs#6063).
    expect(privacy).toMatch(/right to complain to us/);
    expect(privacy).toMatch(/acknowledge it within 30 days/);
  });

  test("/en-gb/legal/app-privacy/ covers every app data flow with version, company and ICO (ut-docs#6398)", async ({ page }) => {
    await page.goto("/en-gb/legal/app-privacy/");
    await expect(page.locator("h1")).toHaveText("Privacy notice for the Universal Till apps");
    const body = await page.locator("article").innerText();
    expect(body).toContain("Version 1.0");
    expect(body).toContain("11442274");
    expect(body).toContain("ZC263752");
    await expect(page.locator('article a[href*="ico.org.uk"]').first()).toBeVisible();
    for (const flow of ["Till check-in", "Usage statistics", "Problem reports", "Diagnostic mode", "Paid-plan cloud sync", "Plugin marketplace", "Update checks", "Barcode lookup", "Payment providers", "The app stores"]) {
      await expect(page.locator("h3", { hasText: flow })).toHaveCount(1);
    }
    // The check-in is planned (ut-docs#6559): the notice must say so, and must not
    // promise a control that is not in the released apps.
    expect(body).toContain("planned");
    expect(body).toContain("We will never send your sales, customers, staff or items.");
    expect(body).not.toContain("Press Stop sending");
    await page.goto("/en-gb/legal/privacy/");
    await expect(page.locator('article a[href="/en-gb/legal/app-privacy/"]')).toHaveCount(1);
  });

  test("marketplace publisher terms and content guidelines are drafts with the required sections (ut-docs#6400)", async ({ page }) => {
    await page.goto("/en-gb/legal/marketplace-terms/");
    await expect(page.locator("h1")).toHaveText("Marketplace publisher terms");
    let body = await page.locator("article").innerText();
    expect(body).toContain("DRAFT: needs owner approval (ut-docs#6400)");
    for (const h of ["Who may publish", "Reports and what we do with them", "Appeals", "Sanctions and restricted parties", "Open legal questions for the owner"]) {
      await expect(page.locator("h2", { hasText: h })).toBeVisible();
    }
    expect(body).toContain("verified publisher identity");
    expect(body).toContain("support@universaltill.com");
    await expect(page.locator('article a[href="/en-gb/legal/marketplace-content-guidelines/"]').first()).toBeVisible();

    await page.goto("/en-gb/legal/marketplace-content-guidelines/");
    await expect(page.locator("h1")).toHaveText("Marketplace content guidelines");
    body = await page.locator("article").innerText();
    expect(body).toContain("DRAFT: needs owner approval (ut-docs#6400)");
    for (const w of ["Malware", "Deception", "Illegal content", "Harvesting personal data", "Bypassing payments or age rules", "Report this listing"]) {
      expect(body).toContain(w);
    }
    await expect(page.locator("h2", { hasText: "Artificial intelligence" })).toBeVisible();
    await expect(page.locator('article a[href="/en-gb/legal/marketplace-terms/"]').first()).toBeVisible();
  });

  test("the marketplace pages have a chrome-less in-app view", async ({ request, page }) => {
    for (const slug of ["marketplace-terms", "marketplace-content-guidelines"]) {
      await page.goto(`/en-gb/app/legal/${slug}/`);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator(".nav-actions")).toHaveCount(0);
    }
  });

  test("the in-app legal view has no Pricing or Get started route (ADR-0194 2.3, ut-docs#6398)", async ({ page }) => {
    await page.goto("/en-gb/app/legal/app-privacy/");
    await expect(page.locator("h1")).toHaveText("Privacy notice for the Universal Till apps");
    await expect(page.locator('a[href*="pricing"], a[href*="find-your-setup"], a[href*="/plans"], .nav-actions')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/en-gb\/legal\/app-privacy\/$/);
    // links to other legal pages stay in the in-app view
    await expect(page.locator('article a[href="/en-gb/app/legal/privacy/"]').first()).toBeVisible();
  });

  test("a non-English locale serves the English legal text, labelled", async ({ page }) => {
    await page.goto("/de-de/legal/refunds/");
    await expect(page.locator("[data-legal-english]")).toBeVisible();
  });
});
