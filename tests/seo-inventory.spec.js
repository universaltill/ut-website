// ut-docs#6887 — the SEO site inventory is served as a noindex JSON file that
// lists exactly the sitemap's URLs (ADR-0211 section 3). Runs against dist/.
import { expect, test } from "@playwright/test";

test("/seo/inventory.json is served noindex, with the global security headers", async ({ request }) => {
  const res = await request.get("/seo/inventory.json");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/json");
  expect(res.headers()["x-robots-tag"]).toContain("noindex");
  expect(res.headers()["content-security-policy"]).toBeTruthy();
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  // The noindex header is per-route: an indexable page must not inherit it.
  for (const p of ["/en-gb", "/de-de/pricing", "/en-gb/blog/"]) {
    const page = await request.get(p);
    expect(page.status(), p).toBe(200);
    expect(page.headers()["x-robots-tag"], p).toBeUndefined();
  }
});

test("inventory rows are exactly the sitemap URLs, and exclude the non-indexed pages", async ({ request }) => {
  const inv = await (await request.get("/seo/inventory.json")).json();
  expect(inv.schemaVersion).toMatch(/^1\./);
  expect(inv.buildSha === null || typeof inv.buildSha === "string").toBe(true);
  expect(inv.rows.length).toBeGreaterThan(0);
  const xml = await (await request.get("/sitemap.xml")).text();
  const paths = new Set([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => new URL(m[1]).pathname));
  for (const row of inv.rows) expect(paths.has(row.path), row.path).toBe(true);
  expect(inv.rows.length).toBe(paths.size);
  expect(inv.rows.some((r) => r.path === "/en-gb/language")).toBe(false);
  expect(inv.rows.some((r) => r.path.includes("partner-privacy"))).toBe(false);
});
