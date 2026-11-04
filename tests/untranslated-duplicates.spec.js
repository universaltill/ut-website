// ut-docs#3811 — Search Console folded /zh-cn/plugins/ and /fa-ir/plugins/
// into one canonical ("Duplicate, Google chose different canonical than
// user") and left /de-de/legal/impressum and friends "Crawled – not indexed":
// the same English text under five URLs. Checked on the raw, JS-free
// response — what a crawler reads first.
import { expect, test } from "@playwright/test";
import fs from "node:fs";

const ORIGIN = "https://www.universaltill.com";
const raw = async (request, path) => (await request.get(path)).text();
const canonicalOf = (html) => html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1];
const hreflangs = (html) => [...html.matchAll(/<link[^>]*rel="alternate"[^>]*hreflang="([^"]+)"/g)].map((m) => m[1]);

import { I18N, LOCALES, SOURCE, renderedText, translated } from "./helpers/locales.js";

// Expectations come from the published list's dictionaries. A key a locale ships is
// asserted to be the locale's text (and not English); a key it does not ship is
// asserted to be the English text, marked lang="en" (per-key fallback).
const PLUGINS = Object.fromEntries(LOCALES.map((l) => [l, {
  title: `${I18N[l]["pluginspage.title"]} — Universal Till`,
  type: I18N[l]["pluginspage.type.payment"],
  download: I18N[l]["pluginspage.download"],
}]));

test.describe("/plugins is in its own language before any JS runs", () => {
  for (const [locale, want] of Object.entries(PLUGINS)) {
    test(`${locale}/plugins/`, async ({ request }) => {
      const html = await raw(request, `/${locale}/plugins/`);
      expect(html).toContain(`<title>${want.title}</title>`);
      expect(renderedText(html, "pluginspage.type.payment")?.trim()).toBe(want.type);
      expect(canonicalOf(html)).toBe(`${ORIGIN}/${locale}/plugins/`);
      // The download action moved to each plugin's own page (ut-docs#4645).
      const detail = await raw(request, `/${locale}/plugins/payment-sumup/`);
      expect(renderedText(detail, "pluginspage.download")?.trim()).toBe(want.download);
      if (locale !== SOURCE && translated(locale, "pluginspage.desc")) expect(html).not.toContain(I18N[SOURCE]["pluginspage.desc"]);
      if (locale !== SOURCE && !translated(locale, "pluginspage.desc")) expect(html).toContain('data-i18n-fallback');
    });
  }
});

test("the shared chrome is server-rendered in the page's locale", async ({ request }) => {
  for (const locale of LOCALES) {
    const html = await raw(request, `/${locale}/plugins/`);
    for (const key of ["nav.news", "nav.get", "foot.privacy", "foot.terms"]) expect(renderedText(html, key), `${locale} ${key}`).toBe(I18N[locale][key]);
  }
  // nav.news is a standard key: the German page really is German.
  expect(renderedText(await raw(request, "/de-de/plugins/"), "nav.news")).toBe("Neuigkeiten");
});

test("footer privacy/terms labels are the published text in every locale", async ({ request }) => {
  for (const locale of LOCALES) {
    for (const path of [`/${locale}/pilot`, `/${locale}/blog/`]) {
      const html = await raw(request, path);
      expect(renderedText(html, "foot.privacy"), path).toBe(I18N[locale]["foot.privacy"]);
      expect(renderedText(html, "foot.terms"), path).toBe(I18N[locale]["foot.terms"]);
    }
  }
});

test.describe("an untranslated legal page points search engines at its English original", () => {
  for (const locale of LOCALES.filter((l) => l !== SOURCE)) {
    test(`${locale}/legal/impressum/`, async ({ request }) => {
      const html = await raw(request, `/${locale}/legal/impressum/`);
      expect(html).toContain("data-legal-english");
      expect(canonicalOf(html)).toBe(`${ORIGIN}/en-gb/legal/impressum/`);
      // It isn't its own canonical, so it declares no hreflang set at all.
      expect(hreflangs(html)).toEqual([]);
    });
  }

  test("the en-gb original stays its own canonical", async ({ request }) => {
    const html = await raw(request, "/en-gb/legal/privacy/");
    expect(canonicalOf(html)).toBe(`${ORIGIN}/en-gb/legal/privacy/`);
    // Only real, approved translations are in the set - none of the legal pages has one yet.
    expect(hreflangs(html).sort()).toEqual(["en-GB", "x-default"]);
  });

  test("the fallback banner is in the visitor's language without JS", async ({ request }) => {
    const html = await raw(request, "/de-de/legal/terms/");
    expect(html).toContain(`<p class="mt-band__text">${I18N["de-de"]["site.legal_english_binding"]}</p>`);
    expect(I18N["de-de"]["site.legal_english_binding"]).toContain("Englisch");
  });
});

test("a fallback post's JSON-LD names the English original and its language", async ({ request }) => {
  const missing = fs
    .readdirSync(new URL("../src/content/blog/en-gb/", import.meta.url))
    .map((f) => f.replace(/\.mdx$/, ""))
    .find((slug) => !fs.existsSync(new URL(`../src/content/blog/de-de/${slug}.mdx`, import.meta.url)));
  test.skip(!missing, "every post has a de-de translation");
  const html = await raw(request, `/de-de/blog/${missing}/`);
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  expect(ld.mainEntityOfPage).toBe(`${ORIGIN}/en-gb/blog/${missing}/`);
  expect(ld.inLanguage).toBe("en-GB");
  expect(canonicalOf(html)).toBe(`${ORIGIN}/en-gb/blog/${missing}/`);
});

test("the sitemap lists only real versions of legal pages and posts", async ({ request }) => {
  const xml = await raw(request, "/sitemap.xml");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].slice(ORIGIN.length));
  // Exactly the legal pages that exist as files, per locale — no fallbacks.
  const onDisk = LOCALES.flatMap((locale) => {
    const dir = new URL(`../src/content/legal/${locale}/`, import.meta.url);
    return fs.existsSync(dir)
      ? fs.readdirSync(dir).filter((f) => f.endsWith(".mdx")).map((f) => `/${locale}/legal/${f.replace(/\.mdx$/, "")}/`)
      : [];
  });
  expect(onDisk).toContain("/en-gb/legal/impressum/");
  expect(locs.filter((l) => l.includes("/legal/")).sort()).toEqual(onDisk.sort());
  // Every listed page is its own canonical — nothing that redirects search
  // engines elsewhere is advertised.
  for (const l of locs.filter((l) => l.includes("/blog/") || l.includes("/legal/") || l.endsWith("/plugins/"))) {
    expect(canonicalOf(await raw(request, l)), l).toBe(`${ORIGIN}${l}`);
  }
});
