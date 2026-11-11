# Remove the "Translated with AI" labels (owner, 2026-11-11)

Owner: every page is machine-translated, so the site no longer advertises it.

## What shipped
- Removed the notice band, footer report link, `/language` AI badge and the blog "Translated automatically" line, in the Astro tree and the plain-HTML `site/` tree (chrome.ts, BaseLayout, marketingPages, site/i18n.js, styles.css).
- Deleted keys `site.machine_label*` and `news.machine` (en, meta, all locales, seed file, regenerated i18n-data.js). The fallback note ("some text isn't translated yet") is a separate mechanism and stays.
- The `machine_label` / `human_reviewed` list flags stay: they only drive the unreviewed-blog-post `noindex` rule.
- Guards: `RETIRED_AI_PHRASES` (every locale's old wording, scripts/lib/locales.mjs) scanned over all built HTML by `check-locale-consistency.mjs`; `tests/locale-label.spec.js` asserts no band/badge/phrase on every locale page, the 404 and a blog post; fixture test asserts the same.
- No ADR requires the disclosure (ut-docs/adr has none); the label spec was ut-docs#5405 (UX), superseded here by owner decision. Risk noted: EU AI Act art. 50 transparency duties may apply to AI-generated text; owner accepted.

## Review (Opus 5.5, independent)
- Medium: guards missed Farsi wording, other-language blog line, and markup-independent reintroduction. Fixed (phrase list, built-HTML scan; negative-tested by injecting the Farsi label).
- Low: dead `.mt-band a` CSS/test selector, stale wording in sync-locales. Fixed.

## Verification
Build, check-locale-consistency, 73 node tests, full Playwright 614 pass; only `help-pages: topics the owner excluded` fails, identically on main (local help source).
Pre-flight: no secrets, no real shop names, no new deps.
