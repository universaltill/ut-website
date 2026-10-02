// ut-docs#3507: Google Analytics 4 runs only after the visitor accepts the
// cookie banner (UK PECR reg. 6 / ePrivacy art. 5(3)). Every request to a
// Google host is intercepted and answered locally, so these tests prove what
// the PAGE asks for, without depending on the network or sending a real hit.
import { expect, test } from "@playwright/test";

const GA_ID = "G-6WZY1CZ94Q";
const GOOGLE = /^https:\/\/([a-z0-9-]+\.)*(googletagmanager|google-analytics|analytics\.google)\.com\//;
const PAGES = ["/en-gb", "/en-gb/download", "/en-gb/start", "/en-gb/pilot", "/en-gb/language", "/en-gb/blog", "/en-gb/plugins", "/en-gb/legal/privacy"];

async function trackGoogle(page) {
  const hits = [];
  await page.route(GOOGLE, (route) => {
    hits.push(route.request().url());
    // A harmless stand-in for gtag.js: real enough for the page, no network.
    route.fulfill({ status: 200, contentType: "application/javascript", body: "/* stub */" });
  });
  return hits;
}

async function collectCspViolations(page) {
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      window.__cspViolations.push({ directive: e.violatedDirective, blocked: e.blockedURI });
    });
  });
}

test.describe("before any choice", () => {
  for (const path of PAGES) {
    test(`${path} shows the banner and contacts no Google host`, async ({ page, context }) => {
      const hits = await trackGoogle(page);
      await page.goto(path);
      const banner = page.locator("#consent-banner");
      await expect(banner).toBeVisible();
      await expect(banner.getByRole("button", { name: "Accept" })).toBeVisible();
      await expect(banner.getByRole("button", { name: "Reject" })).toBeVisible();
      await expect(banner.locator('a[href$="/legal/privacy"]')).toHaveCount(1);
      await page.waitForLoadState("networkidle");
      expect(hits).toEqual([]);
      expect((await context.cookies()).filter((c) => c.name.startsWith("_ga"))).toEqual([]);
    });
  }

  test("Accept and Reject are equally prominent", async ({ page }) => {
    await page.goto("/en-gb");
    const accept = await page.locator("#consent-banner [data-consent=granted]").boundingBox();
    const reject = await page.locator("#consent-banner [data-consent=denied]").boundingBox();
    expect(Math.abs(accept.height - reject.height)).toBeLessThan(1);
    const cls = await page.locator("#consent-banner button").evaluateAll((b) => b.map((x) => x.className));
    expect(cls[0]).toBe(cls[1]);
    expect(accept.height).toBeGreaterThanOrEqual(44);
  });
});

test("Accept loads the GA4 tag with ads signals denied, and persists", async ({ page }) => {
  const hits = await trackGoogle(page);
  await collectCspViolations(page);
  await page.goto("/en-gb");
  await page.locator("#consent-banner [data-consent=granted]").click();
  await expect(page.locator("#consent-banner")).toBeHidden();
  await expect.poll(() => hits.some((u) => u.includes(`gtag/js?id=${GA_ID}`))).toBe(true);
  const layer = await page.evaluate(() => JSON.parse(JSON.stringify(window.dataLayer.map((a) => Array.from(a)))));
  const consent = layer.filter((a) => a[0] === "consent");
  expect(consent[0]).toEqual(["consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" }]);
  expect(consent[1]).toEqual(["consent", "update", { analytics_storage: "granted" }]);
  expect(layer.find((a) => a[0] === "config")).toEqual(["config", GA_ID, { allow_google_signals: false, allow_ad_personalization_signals: false }]);

  // Next page: no banner, tag loads straight away.
  hits.length = 0;
  await page.goto("/en-gb/download");
  await expect(page.locator("#consent-banner")).toBeHidden();
  await expect.poll(() => hits.some((u) => u.includes(`gtag/js?id=${GA_ID}`))).toBe(true);
  expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
});

test("Reject persists and loads nothing", async ({ page }) => {
  const hits = await trackGoogle(page);
  await page.goto("/en-gb");
  await page.locator("#consent-banner [data-consent=denied]").click();
  await expect(page.locator("#consent-banner")).toBeHidden();
  await page.goto("/en-gb/start");
  await expect(page.locator("#consent-banner")).toBeHidden();
  await page.waitForLoadState("networkidle");
  expect(hits).toEqual([]);
});

test("footer Cookie settings reopens the banner; withdrawing deletes _ga cookies", async ({ page, context }) => {
  await trackGoogle(page);
  await page.goto("/en-gb");
  await page.locator("#consent-banner [data-consent=granted]").click();
  // What gtag.js would have set on the first hit.
  await context.addCookies([
    { name: "_ga", value: "GA1.1.1.1", domain: "localhost", path: "/" },
    { name: "_ga_6WZY1CZ94Q", value: "GS1.1.1", domain: "localhost", path: "/" },
  ]);
  await page.locator(".foot-legal [data-consent-open]").click();
  await expect(page.locator("#consent-banner")).toBeVisible();
  await page.locator("#consent-banner [data-consent=denied]").click();
  expect((await context.cookies()).filter((c) => c.name.startsWith("_ga"))).toEqual([]);
  const last = await page.evaluate(() => Array.from(window.dataLayer.filter((a) => a[0] === "consent").pop()));
  expect(last).toEqual(["consent", "update", { analytics_storage: "denied" }]);
});

test("Astro pages carry the Cookie settings control too", async ({ page }) => {
  await page.goto("/en-gb/blog");
  await expect(page.locator(".foot-legal [data-consent-open]")).toHaveCount(1);
});

for (const [locale, accept] of [["de-de", "Akzeptieren"], ["tr-tr", "Kabul et"], ["fa-ir", "پذیرفتن"], ["zh-cn", "接受"]]) {
  test(`/${locale} banner is translated`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await expect(page.locator("#consent-banner [data-consent=granted]")).toHaveText(accept);
    await expect(page.locator('#consent-banner a[href$="/legal/privacy"]')).toHaveAttribute("href", `/${locale}/legal/privacy`);
  });
}

test("withdrawing stops a loaded gtag outright, and re-accepting resumes it", async ({ page }) => {
  await trackGoogle(page);
  await page.goto("/en-gb");
  await page.locator("#consent-banner [data-consent=granted]").click();
  const opener = page.locator(".foot-legal [data-consent-open]");
  await opener.click();
  await page.locator("#consent-banner [data-consent=denied]").click();
  // Consent update alone would leave cookieless pings flowing (review finding).
  expect(await page.evaluate(() => window["ga-disable-G-6WZY1CZ94Q"])).toBe(true);
  await expect(opener).toBeFocused();
  await opener.click();
  await page.locator("#consent-banner [data-consent=granted]").click();
  expect(await page.evaluate(() => window["ga-disable-G-6WZY1CZ94Q"])).toBe(false);
  const last = await page.evaluate(() => Array.from(window.dataLayer.filter((a) => a[0] === "consent").pop()));
  expect(last).toEqual(["consent", "update", { analytics_storage: "granted" }]);
});

test("a choice older than a year asks again", async ({ page }) => {
  const hits = await trackGoogle(page);
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("ut_consent", "granted|" + (Date.now() - 366 * 864e5));
      sessionStorage.setItem("seeded", "1");
    }
  });
  await page.goto("/en-gb");
  await expect(page.locator("#consent-banner")).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(hits).toEqual([]);
});

test("withdrawal on www.universaltill.com deletes GA's .universaltill.com cookies", async ({ page, context, baseURL }) => {
  await trackGoogle(page);
  // Serve the built site under the real host, so the parent-domain deletion
  // (GA4 writes cookie_domain:auto = .universaltill.com) is actually exercised.
  await page.route("https://www.universaltill.com/**", async (route) => {
    const u = new URL(route.request().url());
    route.fulfill({ response: await route.fetch({ url: baseURL + u.pathname + u.search }) });
  });
  await page.goto("https://www.universaltill.com/en-gb");
  await page.locator("#consent-banner [data-consent=granted]").click();
  await context.addCookies([
    { name: "_ga", value: "GA1.1.1.1", domain: ".universaltill.com", path: "/" },
    { name: "_ga_6WZY1CZ94Q", value: "GS1.1.1", domain: ".universaltill.com", path: "/" },
  ]);
  await page.locator(".foot-legal [data-consent-open]").click();
  await page.locator("#consent-banner [data-consent=denied]").click();
  expect((await context.cookies("https://www.universaltill.com")).filter((c) => c.name.startsWith("_ga"))).toEqual([]);
});
