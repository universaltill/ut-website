// ut-docs#3093: the hardware store is hidden from the site. There is no
// device to sell yet and store.universaltill.com does not exist, so every
// link to it was a dead end. The page itself is parked (not deleted) at
// docs/archive/store.html so it can come back later — this guard makes
// "later" a deliberate change to this spec, not an accidental re-link.
//
// Two halves: a source scan of everything that ships (site/ is copied into
// dist/ byte-for-byte; src/ renders the Astro pages and their shared nav),
// and the real routes, so an old bookmark or search result for /store lands
// on the homepage instead of a 404.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const LOCALES = ["en-gb", "tr-tr", "zh-cn", "fa-ir", "de-de"];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(html|js|json|astro|ts|mdx|css|xml)$/.test(e.name) ? [p] : [];
  });
}

const SHIPPED_FILES = [...walk(path.join(ROOT, "site")), ...walk(path.join(ROOT, "src"))];

// "plugin store" / "Play Store" are different things and stay; what's
// banned is anything that sends a visitor to the hardware store.
const BANNED = [
  { name: "store.universaltill.com", re: /store\.universaltill\.com/i },
  { name: 'href="/store"', re: /href=["'`]\/store["'`#?]/i },
  { name: 'href="/<locale>/store"', re: /href=["'`]\/[a-z]{2}-[a-z]{2}\/store["'`#?]/i },
  { name: 'href="#store"', re: /href=["'`][^"'`]*#store["'`]/i },
  { name: "#store in a template link", re: /#store[`'"]/ },
  { name: "nav.store key", re: /nav\.store/ },
  // Review finding: also the L('/store') helper form, a trailing slash or
  // sub-path, store.html, and an absolute universaltill.com store URL.
  { name: "any /store or /<locale>/store path", re: /["'`(=]\s*(?:https?:\/\/(?:www\.)?universaltill\.com)?\/(?:[a-z]{2}-[a-z]{2}\/)?store(?:[\/"'`#?)\s>]|\.html)/i,
    // The redirect rules must name /store; the SWA test below checks them.
    skip: /staticwebapp\.config\.json$/ },
];

test.describe("hardware store is hidden (ut-docs#3093)", () => {
  test("site/store.html is no longer published", () => {
    expect(fs.existsSync(path.join(ROOT, "site", "store.html"))).toBe(false);
  });

  test("no shipped file links to the hardware store", () => {
    const hits = [];
    for (const file of SHIPPED_FILES) {
      const text = fs.readFileSync(file, "utf8");
      for (const { name, re, skip } of BANNED) {
        if (skip && skip.test(file)) continue;
        if (re.test(text)) hits.push(`${path.relative(ROOT, file)}: ${name}`);
      }
    }
    expect(hits).toEqual([]);
  });

  test("the SWA config serves no store page", () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "site/staticwebapp.config.json"), "utf8"));
    const rewrites = cfg.routes.filter((r) => r.rewrite && /store/i.test(r.rewrite));
    expect(rewrites).toEqual([]);
  });

  const REDIRECTS = [["/store", "/en-gb"], ...LOCALES.map((l) => [`/${l}/store`, `/${l}`])];
  for (const [from, to] of REDIRECTS) {
    test(`${from} 301s to ${to}`, async ({ request }) => {
      const res = await request.get(from, { maxRedirects: 0 });
      expect(res.status()).toBe(301);
      expect(res.headers()["location"]).toBe(to);
    });
  }
});
