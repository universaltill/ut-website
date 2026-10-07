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

// Exact strings, so two locales left identical (both English) can't pass.
const PLUGINS = {
  "en-gb": { title: "Plugins — Universal Till", type: "Payment", download: "Download latest" },
  "tr-tr": { title: "Eklentiler — Universal Till", type: "Ödeme", download: "En son sürümü indir" },
  "zh-cn": { title: "插件 — Universal Till", type: "支付", download: "下载最新版本" },
  "fa-ir": { title: "افزونه‌ها — Universal Till", type: "پرداخت", download: "دانلود آخرین نسخه" },
  "de-de": { title: "Plugins — Universal Till", type: "Zahlung", download: "Neueste Version herunterladen" },
};

test.describe("/plugins is in its own language before any JS runs", () => {
  for (const [locale, want] of Object.entries(PLUGINS)) {
    test(`${locale}/plugins/`, async ({ request }) => {
      const html = await raw(request, `/${locale}/plugins/`);
      expect(html).toContain(`<title>${want.title}</title>`);
      expect(html).toMatch(new RegExp(`data-i18n="pluginspage.type.payment"[^>]*>\\s*${want.type}\\s*<`));
      expect(html).toContain(`data-i18n="pluginspage.download">${want.download}<`);
      expect(canonicalOf(html)).toBe(`${ORIGIN}/${locale}/plugins/`);
      if (locale !== "en-gb") expect(html).not.toContain("Every plugin listed here is free, open source");
    });
  }
});

test("the shared chrome is server-rendered in the page's locale", async ({ request }) => {
  const html = await raw(request, "/de-de/plugins/");
  expect(html).toContain('data-i18n="nav.news">Neuigkeiten<');
  expect(html).toContain('data-i18n="nav.get">Loslegen<');
  expect(html).toContain('data-i18n="foot.privacy">Datenschutzerklärung<');
  expect(html).toContain('data-i18n="foot.terms">Nutzungsbedingungen<');
});

test("footer privacy/terms labels are translated in every locale", async ({ request }) => {
  const want = {
    "tr-tr": ["Gizlilik politikası", "Kullanım koşulları"],
    "zh-cn": ["隐私政策", "使用条款"],
    "fa-ir": ["سیاست حریم خصوصی", "شرایط استفاده"],
    "de-de": ["Datenschutzerklärung", "Nutzungsbedingungen"],
  };
  for (const [locale, [privacy, terms]] of Object.entries(want)) {
    for (const path of [`/${locale}/pilot`, `/${locale}/blog/`]) {
      const html = await raw(request, path);
      expect(html, path).toMatch(new RegExp(`data-i18n="foot.privacy"[^>]*>${privacy}<`));
      expect(html, path).toMatch(new RegExp(`data-i18n="foot.terms"[^>]*>${terms}<`));
    }
  }
});

test.describe("an untranslated legal page points search engines at its English original", () => {
  for (const locale of ["tr-tr", "zh-cn", "fa-ir", "de-de"]) {
    test(`${locale}/legal/impressum/`, async ({ request }) => {
      const html = await raw(request, `/${locale}/legal/impressum/`);
      expect(html).toContain('data-i18n="news.untranslated"');
      expect(canonicalOf(html)).toBe(`${ORIGIN}/en-gb/legal/impressum/`);
      // It isn't its own canonical, so it declares no hreflang set at all.
      expect(hreflangs(html)).toEqual([]);
    });
  }

  test("the en-gb original stays its own canonical", async ({ request }) => {
    const html = await raw(request, "/en-gb/legal/privacy/");
    expect(canonicalOf(html)).toBe(`${ORIGIN}/en-gb/legal/privacy/`);
    expect(hreflangs(html).sort()).toEqual(["en-GB", "x-default"]);
  });

  test("the fallback banner is in the visitor's language without JS", async ({ request }) => {
    const html = await raw(request, "/de-de/legal/terms/");
    expect(html).toMatch(/data-i18n="news.untranslated">\s*Dieser Beitrag ist noch nicht übersetzt/);
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
  const onDisk = ["en-gb", "tr-tr", "zh-cn", "fa-ir", "de-de"].flatMap((locale) => {
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
