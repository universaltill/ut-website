// /en-gb/support/ is a real page (ut-docs#5325, work package A): the support
// contact a connector directory listing points at. English only; other
// locales keep their 301 to their own translated contact page.
import { expect, test } from "@playwright/test";

const URL = "/en-gb/support/";

test.describe("/en-gb/support/", () => {
  test("is a 200 page, not a redirect, with one h1 and a self canonical", async ({ request, page }) => {
    const res = await request.get(URL, { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    await page.goto(URL);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://www.universaltill.com/en-gb/support/");
  });

  test("shows both mailboxes (and only those), the reply-time line, no form", async ({ request }) => {
    const html = await (await request.get(URL)).text();
    const mails = [...html.matchAll(/href="mailto:([^"?]+)(\?[^"]*)?"/g)];
    expect([...new Set(mails.map((m) => m[1]))].sort()).toEqual(["security@universaltill.com", "support@universaltill.com"]);
    expect(html).toContain("mailto:support@universaltill.com?subject=Support%20question");
    expect(html).toContain("mailto:security@universaltill.com?subject=Security%20report");
    expect(html).toContain("We usually reply within a couple of days.");
    expect(html).not.toMatch(/<form|<input|<textarea/);
    expect(html).toContain("Task Runner Technology LTD");
    for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) expect(m[1], "cross-origin script").not.toMatch(/^(https?:)?\/\//);
  });

  test("explains connecting and disconnecting an assistant", async ({ page }) => {
    await page.goto(URL);
    const body = await page.locator("article").innerText();
    expect(body).toContain("Connected assistants");
    expect(body).toContain("activation code");
    expect(body).toMatch(/revoke/i);
  });

  test("links to claude, help, privacy, terms, impressum and security.txt, all 200", async ({ request }) => {
    const html = await (await request.get(URL)).text();
    for (const href of ["/en-gb/claude/", "/en-gb/help/", "/en-gb/contact", "/en-gb/legal/privacy/", "/en-gb/legal/subscription-terms/", "/en-gb/legal/terms/", "/en-gb/legal/impressum/", "/.well-known/security.txt"]) {
      expect(html, href).toContain(`href="${href}"`);
      expect((await request.get(href)).status(), href).toBe(200);
    }
  });

  test("is in the sitemap", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain("<loc>https://www.universaltill.com/en-gb/support/</loc>");
  });

  test("/en-gb/support without a slash reaches the page", async ({ request }) => {
    const res = await request.get("/en-gb/support");
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain("We usually reply within a couple of days.");
  });

  test("another locale still 301s to its own contact page", async ({ request }) => {
    const res = await request.get("/de-de/support", { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(res.headers()["location"]).toBe("/de-de/contact");
  });
});
