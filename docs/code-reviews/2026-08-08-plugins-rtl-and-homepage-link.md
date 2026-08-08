# 2026-08-08 — RTL-on-untranslated-content fix + homepage→/plugins link (ut-docs#353)

## What shipped

`ut-docs#353` was filed 2026-08-06 against an earlier version of the site's
routing; re-verified against current `main` before scoping (the site has
since gained real per-locale URL routing for `/blog` and `/plugins` via
`ADR-0038`'s rollout, so most of the original ticket's specific complaints
— no locale-prefixed URLs, no `data-i18n` on the nav — are already fixed).
Two real gaps remained:

1. **English-only content still rendered `dir="rtl"` for fa-ir visitors.**
   `BaseLayout.astro` correctly derives `<html dir>` from the URL's locale
   segment — right for the translated chrome (nav/footer), wrong for
   content that has no translation at all:
   - `/plugins` (`src/pages/[...lang]/plugins.astro`) is entirely
     build-time-fetched English (GitHub manifests) with no translation
     mechanism. Fixed with `dir="ltr" lang="en"` on its content `<section>`,
     unconditionally (the page is always English).
   - Blog posts fall back to the English original when a locale's
     translation doesn't exist yet (`isFallback`, from `src/lib/
     blogPosts.ts`). Fixed the same way, conditional on `isFallback` only —
     a real translation (including a machine one, `machineTranslated`)
     keeps its own locale's direction. Initially only the body `<div>` was
     covered; independent review found the `<h1>` and date/author line
     sitting outside it were missed too (see below).
2. **`/plugins` was unreachable from the homepage.** The `#plugins`
   marketing section described the catalogue but never linked to it.
   Added a `Browse all plugins` CTA (translated in all 4 locales via a new
   `plugins.cta` i18n key), mirroring the existing `#store` section's CTA
   pattern.

New regression suite: `tests/rtl-content-direction.spec.js`.

## Independent review (Opus, different model from the Sonnet that wrote
this — model routing per this card's `complexity:medium` label)

Ran the full build + test suite itself rather than trusting the diff, and
independently re-verified the TDD claim (temporarily removed a real
translation file, rebuilt, grepped the output, restored it, confirmed the
tree was clean again). Overall verdict: **safe to merge**, no blockers.
Findings and disposition:

| Severity | Finding | Fixed? |
|---|---|---|
| Should-fix | Blog `isFallback` fix only forced `ltr` on the body `<div>` — the `<h1>` and date/author `<p>` sat outside it and still rendered `dir="rtl"` for an English fallback title/byline. Measured impact on the actual current title: right-alignment only (the `·` separator folds into one bidi run per rule N1), but any fallback title ending in punctuation would render it on the wrong end — the exact defect class this card exists to fix | **Yes** — same `isFallback`-conditional `dir`/`lang` attributes added to the `<h1>` and the date/author `<p>` |
| Nitpick | New `#plugins` CTA button sat flush against the lede paragraph (`.section-sub { margin: 0 }`, no `.section-head .btn` rule existed to give it top spacing, unlike `.cta-band .btn { margin-top: 1rem }`) | **Yes** — added `.section-head .btn { margin-top: 1.2rem; }` |
| Nitpick | The CTA-translation test only ever compared fa-ir against en-gb ("differs from English") — tr-tr and zh-cn had no coverage at all and either could have shipped untranslated with the test still green | **Yes** — rewritten to assert the exact expected string per locale (all 4) |

Non-findings explicitly checked and cleared by the reviewer: no `[dir=`
CSS selectors anywhere in the repo (fully logical-property based, so
`dir="ltr"` cascades to cards/buttons with no inconsistency — verified
computed `.card` direction under fa-ir); the 4 translations are sane, not
copy-pasted or gibberish; the `/plugins` unprefixed homepage link 301s
correctly and matches the site's existing pattern for `/blog`/`/store`/
`/download` (a pre-existing property of the plain-HTML pages, not a new
inconsistency this diff introduces); no hardcoded strings that should have
been `data-i18n`; no client/shop names or secret-shaped literals.

## Verified beyond automated tests

- `npm run build` — clean, 16 pages, all 13 plugin manifests fetched (no
  degraded cards from a transient fetch failure).
- `npx playwright test --project=chromium` — **76/76 passing** (72 before
  the review-fix round, +4 from strengthening the CTA-translation coverage
  and adding the machine-translated-title regression test), including every
  pre-existing suite (`site-consistency`, `astro-pages-nav`, `seo`,
  `mobile-nav`) with zero regressions.
- `node scripts/check-i18n-keys.js` — OK (4 locales, 169 keys, no drift).
- TDD claim re-verified twice, independently: once by me during
  implementation (removed `src/content/blog/fa-ir/whats-new-v0-2-70.mdx`,
  rebuilt, confirmed `dir="ltr" lang="en"` on the body div, restored),
  and again by the review subagent in an isolated worktree after the
  h1/byline fix was added (same procedure, confirmed all three — title,
  byline, body — now force `ltr`, and the real translation `blog-is-live`
  is untouched; 0 occurrences of `dir="ltr"` in its output).
- Read the built HTML directly (not just test output) to confirm
  `<html dir="rtl">` is unchanged for fa-ir on both `/plugins` and the
  blog fallback page — the content-region override doesn't leak into the
  page chrome.
- This diff is entirely `ut-website` (the public marketing site) — no
  `universal-till` product UI touched, so the shop-owner manual
  (`web/help/`) requirement is correctly not applicable here.

## Safe-to-merge verdict

Safe to merge. All findings from the independent review are resolved and
re-verified; nothing deferred.
