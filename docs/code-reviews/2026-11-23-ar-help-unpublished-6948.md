# Review: Arabic help unpublished on the website (ut-docs#6948)

Date: 2026-11-23 · Branch: `fix/6948-ar-help-unpublished` · Decision: owner on
ut-docs#5355 (Arabic help is not published; ut-cloud `internal/helpdocs`
`PublicURL` already returns "" for `ar`)

## What shipped

- `scripts/lib/help-locales.mjs` (new): `HELP_UNPUBLISHED = ["ar-sa"]` as data,
  plus `hasHelp` / `helpLocaleFor`. Re-exported for Astro by
  `src/lib/helpLocales.ts` and `src/lib/help.ts`, for specs by
  `tests/helpers/locales.js`.
- `/[lang]/help/` and `/[lang]/help/[slug]/` `getStaticPaths` skip those
  locales, so there are no `dist/ar-sa/help/` pages. The sitemap leaves out
  their help URLs. The help index's hreflang set is `LANGS.filter(hasHelp)`;
  topic pages already listed only translated locales.
- ar-sa Help links go to `/en-gb/help/`: the BaseLayout header and footer
  (`LH`); `site/*.html` `/help` links via `marketingPages.localizedHref`; the
  client language picker via `pathFor` in `site/i18n.js`, which reads `noHelp`
  from the generated `site/i18n-data.js` (`gen-locales.mjs`).
- `scripts/guard-help.mjs` checks only locales that have help. It fails if a
  help directory exists for an unpublished-help locale, or if the sitemap lists
  one of its help URLs.
- Specs: help-pages (ar-sa block), help-link, contact-page, seo sitemap.
- Review additions (below): a 301 for the old ar-sa help URLs, a fix for the
  client relinking, and a guard crash fix with tests for it.

## Review

Independent review by an Opus 5.5 subagent. Sonnet wrote the code.

| # | Sev | Finding | Outcome |
|---|---|---|---|
| 1 | Medium | `guard-help.mjs` called `fail()` in the new unpublished-locale loop **before** `const errors`/`const fail` were declared (TDZ). The check was meant to report a stray `dist/ar-sa/help/`. In that case it crashed with `ReferenceError: Cannot access 'fail' before initialization` instead, and the clean case never reached the line. No guard test covered either new check. | **Fixed**: the loop now runs after the declarations. Two `mustFail` cases in `scripts/guard-help_test.mjs`: a stray ar-sa help page, and an ar-sa help URL in the sitemap. The first fails against the WIP guard (TDZ crash, stderr does not match) and passes after the fix. |
| 2 | Medium | Client relinking in `site/i18n.js` (`apply()`, used on popstate/`go()` and on the **shared `404.html`**, whose links are prerendered `/en-gb/...`) rewrote `/<shown>/help/` to `/<lang>/help/` without going through `pathFor`. A visitor on `/ar-sa/<anything missing>`, or with `ut_lang=ar-sa` on any 404, got header and footer Help links to `/ar-sa/help/`. That contradicts the card's "every ar-sa Help link → /en-gb/help/". | **Fixed**: the new `relink(lang, rest)` sends a `/help…` rest to `DEFAULT` for a `noHelp` locale and keeps the old behaviour otherwise (`""`, `"/"`, `?`/`#` preserved). New spec "the shared 404 page under ar-sa links Help to the English help after i18n.js runs" fails on WIP (`Received: "/ar-sa/help/"`) and passes now. |
| 3 | Low (decision) | `/ar-sa/help/…` was live before this change (it rendered English text; the removed spec asserted 200), so crawlers and bookmarks know those URLs. A 404 drops them with no landing page. The site already handles this case for withdrawn locales: `localeRoutes` 301s their `ASTRO_INDEXES` (including `/help/`) to `/en-gb/…`. | **Fixed (reviewer decision)**: `localeRoutes` now emits `/<loc>/help` and `/<loc>/help/*` → `/en-gb/help/` 301 for every published locale in `HELP_UNPUBLISHED`. The routes are data-driven, so removing the list entry removes them too. Static Web Apps cannot carry a wildcard capture into a redirect target, so topic URLs land on the help index. `staticwebapp.config.json` was regenerated (13,252 bytes, guard limit 18,000). Pages are still not built, the sitemap and hreflang are unchanged, and `PublicURL` still emits no ar link, so the "not published" decision holds. Pinned by a `locale-fixtures_test.mjs` case and by the ar-sa specs (now expecting 301 + `Location: /en-gb/help/`). `internal-links.spec`'s every-redirect check confirms that `/en-gb/help/` answers 200 and is its own canonical. |
| 4 | Nit | After a client-side switch *from* ar-sa (`go()`, not used by site UI), Help links stay `/en-gb/help/`, because they don't start with `/ar-sa`. | Accepted: the next page load renders the right link, and no UI calls `go()`. |
| 5 | Nit | `helpLocaleFor` hardcodes `"en-gb"` instead of `SOURCE`. | Accepted: importing `SOURCE` would make `locales.mjs` ↔ `help-locales.mjs` circular. `en-gb` is the help source locale here, and `help.ts` and `marketingPages.ts` have the same pre-existing literal. |

Checked, no issue: no `/ar-sa/help` string anywhere in `dist/` (HTML, XML,
txt, JSON) after the build. hreflang on `/en-gb/help/` and topic pages has no
`ar-SA`, and x-default still points to en-gb. `ar-sa/blog` and other pages keep
their full hreflang set. `404.html` links are already `/en-gb/help/`. No
blog/legal/connector content links `/help`. Help-body links are built only
for built (has-help) locales. `seo-inventory` reports 0 problems. No new
user-facing strings and no CSS. `i18n-data.js` is in sync (`--check`). Other
fallback locales (zh-cn, es-es, …) are unchanged.

## Extra verification

- `HELP_SRC_DIR=…/universal-till/web/help npm run build`: OK (938 pages,
  seo-inventory 0 problems). `node scripts/guard-help.mjs`: OK (517 pages,
  11 locales, 46 topics). `node scripts/gen-locales.mjs --check`: up to date.
  `check-swa-config.js` and `check-locale-consistency.mjs`: OK.
- `node --test src/lib/help_test.mjs scripts/guard-help_test.mjs
  scripts/locale-fixtures_test.mjs`: 54/54. In the combined
  `scripts/*_test.mjs` run, `locale-fixtures_test.mjs`'s `before` hook fails
  in this environment (an astro fixture build, `@oslojs` base64 TypeError).
  That fails all of its tests, including the new one, the same way as on
  origin/main, and the file passes when run alone. The partner-privacy draft
  test fails because `../ut-docs` is beside us (environmental, as Tester noted).
- Full `npx playwright test --trace off`: **1279 passed, 1 skipped, 0 failed**.
- Dev's TDD claim re-verified in a throwaway worktree: I removed the
  `localizedHref` help line in `src/lib/marketingPages.ts`, and
  `contact-page.spec.js` ar-sa failed with `Expected substring:
  "href=\"/en-gb/help/\""`. After restoring it, both ar-sa contact tests pass.
  Tester's mutations (i18n.js noHelp, sitemap guard) are in tester.md.

Pre-flight: help topic `n/a` (website publishing only, no product behaviour);
`reference/` `n/a`; README `updated` (help section: 301, list file); en.json
keys `n/a` (none); website locales `n/a` (no strings); review record `updated`;
follow-ups `deferred` (below).

## Verdict

Safe to merge after the fixes above. The full gate is green.

## Deferred / follow-ups

- ut-cloud `internal/helpdocs/public_live_test.go` and `helpdocs.go:620`
  comments say `/ar-sa/help/` "is a 404". It is now a 301 to the English help.
  This is comment-only and behaviour is unaffected (`PublicURL("…","ar")` stays
  ""). Epic checklist line on ut-docs#6948 / #5355.
