// /<locale>/contact and the /<locale>/support redirect for every locale except
// en-gb, which has a real support page since ut-docs#5325 (support-page.spec.js). Plain
// mailto links to allow-listed aliases only: no form, no third-party service.
import { expect, test } from "@playwright/test";

import { LOCALES } from "./helpers/locales.js";

const ALLOWED = ["support@universaltill.com", "hello@universaltill.com", "partners@universaltill.com", "security@universaltill.com"];

test.describe("/contact", () => {
  for (const locale of LOCALES) {
    test(`${locale}: 200, four allow-listed mailto links, no form`, async ({ request }) => {
      const res = await request.get(`/${locale}/contact`);
      expect(res.status()).toBe(200);
      const html = await res.text();
      const addrs = [...html.matchAll(/href="mailto:([^"?]+)(\?[^"]*)?"/g)].map((m) => m[1]);
      expect([...new Set(addrs)].sort()).toEqual([...ALLOWED].sort());
      for (const a of addrs) expect(ALLOWED).toContain(a);
      expect(html).not.toMatch(/<form|<input|<textarea/);
      expect(html).toContain(`href="/${locale}/pilot"`);
      expect(html).toContain(`href="/${locale}/help/"`);
      expect(html).toContain(`href="/${locale}/download"`);
      expect(html).toContain(`href="/${locale}/legal/impressum/"`);
      expect(html).toContain("Task Runner Technology LTD");
      expect(html).toContain(`<link rel="canonical" id="canonical" href="https://www.universaltill.com/${locale}/contact">`);
    });
  }

  test("en-gb: each mailto has a sensible subject; the reply-time line is the pilot page's own", async ({ request }) => {
    const html = await (await request.get("/en-gb/contact")).text();
    const subjects = Object.fromEntries([...html.matchAll(/href="mailto:([^"?]+)\?subject=([^"&]+)"/g)].map((m) => [m[1], decodeURIComponent(m[2])]));
    expect(subjects).toEqual({
      "support@universaltill.com": "Support question",
      "hello@universaltill.com": "Plans and pricing",
      "partners@universaltill.com": "Partner enquiry",
      "security@universaltill.com": "Security report",
    });
    expect(html).toContain("We usually reply within a couple of days.");
    expect(html).not.toMatch(/\b\d+\s*(hours?|business days?)\b/i);
  });

  test("every internal link on the page answers 200", async ({ request }) => {
    const html = await (await request.get("/en-gb/contact")).text();
    const hrefs = new Set([...html.matchAll(/href="(\/[^"#?]*)"/g)].map((m) => m[1]).filter((h) => !/\.(css|svg|js)$/.test(h)));
    for (const h of hrefs) expect((await request.get(h)).status(), h).toBe(200);
  });

  test("it loads no script from another origin", async ({ request }) => {
    const html = await (await request.get("/en-gb/contact")).text();
    expect(html).not.toMatch(/<script[^>]+src="https?:/);
  });

  test("Contact is linked from the footer of the home page, a marketing page and an Astro page in every locale", async ({ request }) => {
    for (const locale of LOCALES) {
      for (const p of ["", "/download", "/find-your-setup", "/blog/", "/plugins/", "/help/"]) {
        const html = await (await request.get(`/${locale}${p}`)).text();
        expect(html, `${locale}${p}`).toMatch(new RegExp(`<footer[\\s\\S]*href="/${locale}/contact"`));
      }
    }
  });
});

test.describe("/support redirects to /contact", () => {
  for (const locale of LOCALES.filter((l) => l !== "en-gb")) {
    test(`/${locale}/support 301s to /${locale}/contact`, async ({ request }) => {
      const res = await request.get(`/${locale}/support`, { maxRedirects: 0 });
      expect(res.status()).toBe(301);
      expect(res.headers()["location"]).toBe(`/${locale}/contact`);
    });
  }
  for (const [from, to] of [["/support", "/en-gb/support/"], ["/contact", "/en-gb/contact"], ["/pricing", "/en-gb/pricing"], ["/pricing.html", "/en-gb/pricing"], ["/contact.html", "/en-gb/contact"]]) {
    test(`${from} 301s to ${to}`, async ({ request }) => {
      const res = await request.get(from, { maxRedirects: 0 });
      expect(res.status()).toBe(301);
      expect(res.headers()["location"]).toBe(to);
    });
  }
});
