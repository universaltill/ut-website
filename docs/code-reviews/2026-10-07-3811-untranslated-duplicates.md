# Review: /plugins translated, untranslated fallbacks canonicalise to English (ut-docs#3811)

**Date:** 2026-10-07 · **Built by:** Claude Opus 5.5 (lane:cloud-24) · **Reviewed by:** Claude Fable 5.1 (independent subagent, separate worktree)

## What shipped

Search Console: `/zh-cn/plugins/`, `/fa-ir/plugins/` "Duplicate, Google chose
different canonical"; `/de-de/plugins/`, `/en-gb/legal/impressum`,
`/zh-cn/legal/terms/` "Crawled – not indexed". The same English text sat under
five URLs, each claiming to be its own canonical.

- **/plugins translated (option a).** New `pluginspage.*` keys (title, meta
  description, intro, type headings, Repo/Download/no-release labels, footer
  note) in all five `site/i18n.js` locales. Plugin names/descriptions are each
  repo's manifest (English), so only those two elements keep `dir="ltr"
  lang="en"`; the section follows the locale.
- **Chrome rendered at build time.** `BaseLayout.astro` exports `t(locale,key)`
  over the same dict `i18n.js` applies at runtime; nav, footer, the menu
  aria-label, the blog index heading/subtitle, the post notes and the
  fallback banner are now in the page's language in the raw HTML.
- **Standing rule for fallbacks (option b).** A legal page or post served as
  the English stand-in: canonical → its `/en-gb/…` URL, no hreflang set, out of
  `sitemap.xml`; originals declare only real translations
  (`translatedLangsOf` in `src/lib/legalPages.ts` / `blogPosts.ts`). JSON-LD
  on a fallback post names the en-gb URL and `inLanguage: en-GB`.
- **Footer labels** `foot.privacy` / `foot.terms` translated in tr/zh/fa/de.
- Tests: new `tests/untranslated-duplicates.spec.js` (16); `internal-links`
  gains one narrow exception (a linked page that carries the untranslated
  banner and canonicalises to its own en-gb original); `seo`,
  `site-consistency` and `rtl-content-direction` specs now derive the
  expected sitemap/hreflang sets from the content files on disk.
- README bullet for the rule.

## Findings

| # | Sev | Finding | Outcome |
|---|---|---|---|
| 1 | minor | Fallback post JSON-LD `inLanguage` was the URL locale while body/canonical are English | Fixed: `SOURCE_LOCALE` on fallback; test added |
| 2 | minor | Fallback pages emitted an hreflang set without themselves | Fixed: no hreflang (incl. x-default) on a fallback; test updated |
| 3 | minor | Sitemap test hard-coded the three en-gb legal URLs (breaks on the first real translation) | Fixed: derived from `src/content/legal/<locale>/*.mdx` |
| 4 | nit | de "Themes" vs "Designs" elsewhere in the de dict | Fixed: "Designs" |
| 5 | nit | tr "manifest başvurusu" / fa "نمونهٔ کارا" wording | Fixed: "manifest referansı" / "نمونهٔ عملی" |
| 6 | nit | Astro `<title>` has no `data-i18n-content`, so a no-reload `go()` leaves it stale | Accepted, pre-existing; `go()` has no UI caller (the picker reloads) |
| 7 | nit | `news.untranslated` says "post" on legal pages; `<html lang>` is the locale over an English body | Accepted, pre-existing and documented; body/h1 carry `lang="en"` |
| 8 | nit | Plugins tests need the build-time manifest fetch | Accepted; the existing rtl spec already depends on it |

## Verified beyond automated tests

- TDD: reviewer reverted `src/` + `site/` to `main`, rebuilt — the new spec
  failed 14/14 on real assertions; restored — passed.
- Raw HTML of `/zh-cn/plugins/`, `/fa-ir/plugins/`, `/de-de/legal/impressum/`,
  `/de-de/blog/` inspected; reviewer drove the pages in Chromium after JS ran:
  runtime `apply()` is a no-op over the server text, the fallback canonical is
  not rewritten by `i18n.js`, no console errors.
- Screenshots of `/fa-ir/plugins/` (390px, RTL — manifest text ltr inside rtl
  chrome) and `/de-de/plugins/` (390px, 1280px — longest labels wrap, no
  horizontal scroll).
- Gates: `check-i18n-keys`, `astro build` + site/ pass-through, `postbuild`,
  `generate-csp --check`, `guard-compliance-claims`, `check-swa-config`,
  `translate-posts`, full Playwright suite 284/284.

## Deferred

- Two posts have no de-de translation (`blog-is-live`, `whats-new-v0-2-70`);
  they now correctly canonicalise to English. Follow-up card filed.
- Legal pages remain English outside en-gb by design (option b).

**Verdict:** safe to merge.
