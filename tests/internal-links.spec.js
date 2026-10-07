// Regression tests for ut-docs#3798 — Search Console reported pages "not
// indexed" as Page with redirect, Alternative page with proper canonical,
// Duplicate (Google chose a different canonical) and noindex. The sitemap
// itself was clean; the flagged URLs were ones the site LINKED to:
//
//   * the prerendered marketing pages kept the template's unprefixed links
//     (/download, /blog, /legal/privacy …), every one a 301 — and the legacy
//     redirects all land on /en-gb, so a visitor on /de-de clicking Download
//     was dropped into English;
//   * the Astro pages linked to /de-de/blog while the canonical is
//     /de-de/blog/ — the slashless form answers 200 as a duplicate;
//   * the raw templates (/index.html, /download.html …) were reachable and
//     canonical to a redirecting URL.
//
// So: every page in the sitemap, read raw (no JS — what a crawler sees
// first), may only point at URLs that answer 200 DIRECTLY, and a linked page
// must be its own canonical (a 200 that canonicalises elsewhere is a duplicate).
import { expect, test } from "@playwright/test";

const ORIGIN = "https://www.universaltill.com";

const local = (href) => (href.startsWith(ORIGIN) ? href.slice(ORIGIN.length) || "/" : href);
const decode = (s) => s.replace(/&amp;/g, "&");

async function sitemapPaths(request) {
  const xml = await (await request.get("/sitemap.xml")).text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => local(m[1]));
}

// Same-site link targets in a raw page: <a href>, canonical, hreflang
// alternates. Fragments are dropped (they never reach the server).
function targets(html) {
  const out = [];
  for (const m of html.matchAll(/<(a|link)\b[^>]*>/gi)) {
    const tag = m[0];
    const href = tag.match(/\bhref="([^"]*)"/i)?.[1];
    if (!href) continue;
    if (m[1].toLowerCase() === "link" && !/rel="(canonical|alternate)"/i.test(tag)) continue;
    if (/type="application\/rss\+xml"/i.test(tag)) continue; // a feed, not a page
    const path = decode(local(href)).split("#")[0];
    if (!path.startsWith("/") || path.startsWith("//")) continue;
    // Installer files: deploy.yml writes these as redirects to the GitHub
    // release at deploy time — downloads, not pages, and absent locally.
    if (path.startsWith("/downloads/")) continue;
    out.push(path);
  }
  return out;
}

test("every sitemap page links only to URLs that answer 200 directly", async ({ request }) => {
  const pages = await sitemapPaths(request);
  expect(pages.length).toBeGreaterThan(40);
  const linkedFrom = new Map();
  for (const page of pages) {
    const html = await (await request.get(page)).text();
    for (const t of targets(html)) {
      if (!linkedFrom.has(t)) linkedFrom.set(t, page);
    }
  }
  const bad = [];
  for (const [target, from] of linkedFrom) {
    const res = await request.get(target, { maxRedirects: 0 });
    if (res.status() !== 200) {
      bad.push(`${from} → ${target} answers ${res.status()} ${res.headers()["location"] ?? ""}`.trim());
      continue;
    }
    if (!(res.headers()["content-type"] ?? "").includes("text/html")) continue;
    const html = await res.text();
    const canonical = html.match(/<link\b[^>]*rel="canonical"[^>]*>/i)?.[0].match(/href="([^"]*)"/)?.[1];
    // The one allowed exception (ut-docs#3811): an untranslated page that
    // says so, canonicalising to its own en-gb original. The footer has to
    // link /de-de/legal/privacy/ to keep a German reader in German, and the
    // page is out of the sitemap — but nothing else may canonicalise away.
    const enOriginal = target.replace(/^\/[a-z]{2}-[a-z]{2}\//, "/en-gb/");
    if (canonical && local(canonical) === enOriginal && html.includes('data-i18n="news.untranslated"')) continue;
    if (canonical && local(canonical) !== target.split("?")[0]) {
      bad.push(`${from} → ${target} is a duplicate of ${local(canonical)}`);
    }
  }
  expect(bad, bad.join("\n")).toEqual([]);
});

test("links to the language picker are nofollow (it is noindex)", async ({ request }) => {
  for (const page of ["/de-de", "/de-de/download", "/de-de/blog/", "/de-de/legal/privacy/"]) {
    const html = await (await request.get(page)).text();
    const links = [...html.matchAll(/<a\b[^>]*href="[^"]*\/language[?"][^>]*>/gi)].map((m) => m[0]);
    expect(links.length, page).toBeGreaterThan(0);
    for (const a of links) expect(a, page).toMatch(/\brel="nofollow"/);
  }
});

test("the language picker carries the page to return to, at build time", async ({ request }) => {
  const html = await (await request.get("/de-de/download")).text();
  expect(html).toContain('href="/de-de/language?from=%2Fdownload"');
});

for (const [from, to] of [
  ["/index.html", "/en-gb"],
  ["/download.html", "/en-gb/download"],
  ["/start.html", "/en-gb/start"],
  ["/pilot.html", "/en-gb/pilot"],
  ["/language.html", "/en-gb/language"],
]) {
  test(`raw template ${from} 301s to ${to}`, async ({ request }) => {
    const res = await request.get(from, { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(res.headers()["location"]).toBe(to);
  });
}

test("a German visitor's Download link stays German", async ({ request }) => {
  const html = await (await request.get("/de-de")).text();
  expect(html).toMatch(/href="\/de-de\/download"/);
  expect(html).not.toMatch(/href="\/download"/);
});

test("a language switch without a reload moves the page's links to the new language", async ({ page }) => {
  await page.goto("/en-gb/download");
  await page.evaluate(() => window.UT_I18N.go("de-de"));
  await expect(page).toHaveURL(/\/de-de\/download$/);
  await expect(page.locator('a[data-i18n="dl.pilotlink"]')).toHaveAttribute("href", "/de-de/pilot");
  await expect(page.locator('.foot-legal a[data-i18n="foot.privacy"]')).toHaveAttribute("href", "/de-de/legal/privacy/");
});

test("a post's link to its English original stays English", async ({ page }) => {
  await page.goto("/tr-tr/blog/whats-new-v0-2-70/");
  await page.evaluate(() => window.UT_I18N.go("de-de"));
  await expect(page).toHaveURL(/\/de-de\/blog\/whats-new-v0-2-70\/$/);
  await expect(page.locator('a[data-i18n="news.original"]')).toHaveAttribute("href", "/en-gb/blog/whats-new-v0-2-70/");
});

// The legacy unprefixed URLs are the ones already in Google's index and in
// old external links, so each redirect must end on a page that is its own
// canonical — not on a slashless duplicate (review finding, ut-docs#3798).
test("every redirect in staticwebapp.config.json lands on a 200 that is its own canonical", async ({ request }) => {
  const fs = await import("node:fs");
  const config = JSON.parse(fs.readFileSync(new URL("../site/staticwebapp.config.json", import.meta.url), "utf8"));
  const bad = [];
  for (const r of config.routes.filter((x) => x.redirect)) {
    const from = r.route.endsWith("/*") ? r.route.slice(0, -1) + "whats-new-v0-2-70" : r.route;
    const first = await request.get(from, { maxRedirects: 0 });
    if (first.status() !== 301) { bad.push(`${from} answers ${first.status()}, expected 301`); continue; }
    const to = first.headers()["location"];
    const res = await request.get(to, { maxRedirects: 0 });
    if (res.status() !== 200) { bad.push(`${from} → ${to} answers ${res.status()}`); continue; }
    const canonical = (await res.text()).match(/<link\b[^>]*rel="canonical"[^>]*>/i)?.[0].match(/href="([^"]*)"/)?.[1];
    if (canonical && local(canonical) !== to) bad.push(`${from} → ${to} is a duplicate of ${local(canonical)}`);
  }
  expect(bad, bad.join("\n")).toEqual([]);
});
