# Review: website cutover to the published-locale list (ut-docs#5406, #5408, #5409 website part)

Scope: stacked on #79 (feat/5405-i18n-source). Reviewer: independent Opus subagent (author: Sonnet), ran the guards, build and three Playwright specs, and mutation-tested three new assertions in a scratch worktree.

## What shipped
Seed of the five live locales into `i18n/published/locales.json` + `i18n/<locale>.json`; `scripts/gen-locales.mjs` (i18n-data.js + locale routes); list-driven lang/dir/hreflang/canonical/sitemap/switcher/my. link; AI band, badge, fallback note; English-only legal pages; noindex for unreviewed machine-translated posts; `check-locale-consistency` and two fixture builds; specs over the list.

## Findings
| # | Severity | Finding | Outcome |
|---|---|---|---|
| 1 | Major (security) | `htmlProblems` allow-list bypass: `<code/onmouseover=...>` (slash separator), no check of attributes on allowed tags (`style`, `target`) | Fixed: per-tag attribute allow-list (only `a[href]`), href must be `/`, `#`, `https:` or `mailto:`, comments/CDATA/malformed tags rejected; self-test with 11 hostile values |
| 2 | Major | Legal-tier keys (consent.*, foot.*, hero.lede, faq.a2, why.exit.*, price lines...) are English on the four non-English live locales; only 8 keys were `core`, so a locale missing nav/title would still publish | Core gate fixed (25 more standard chrome keys marked `core`: nav.*, language.*, site.*, meta.*.title, foot.tagline). The English fallback itself is the ADR rule (legal-tier keys omitted until a human approves) and the pinned classification from #79; **accepted, owner decision needed** (reclassify consent/footer labels or name human reviewers) |
| 3 | Major (visible change) | All translated posts noindex; switcher order changes; band/badge/note on every non-English page; `/de` alias | Intended by ADR-0177 / UX spec; listed in the PR body |
| 4 | Minor | Alias `/pt` duplicated when two locales share a language; odd url (es-419) not refused; withdrawn alias missing | Fixed (alias dedupe, url format check, withdrawn alias) with tests |
| 5 | Minor | Withdrawn deep pages land on en-gb home via `/xx/*` (SWA cannot substitute a path); known pages 301 to the same page | Accepted, `withdrawn` is `[]` today |
| 6 | Minor | Astro body text outside `CHROME_KEYS`+`keys` is not span-wrapped / does not trigger the note | Accepted: only chrome and blog/plugins pages; i18n.js wraps on load; follow-up |
| 7 | Minor | Band shows above English-only legal pages / English fallback posts | Accepted: owner wants the label on every page of an unreviewed locale; the page also carries the binding / untranslated notice |
| 8 | Minor | False-pass risks: text-transform never checked, 44px only on one page, no test that an approved legal translation is served | Two fixed (text-transform check, 44px on four pages); legal-approved-with-file case deferred (needs translated MDX fixtures) |

## Verified beyond the automated tests
`sanitizeFrom` unchanged and its hostile `?from=` spec passes; the removed inline script's CSP hash dropped; `<title>` never gets a fallback span; i18n-data.js loads before i18n.js on every page; hand-kept SWA routes and order unchanged (only `/de` added); three mutations each fail the intended test (reviewed-flip, legal notice, English link path).

## Not run
axe, VoiceOver/NVDA, real touch device, screenshot review of ms/ar/de at 360/768/1280 (UX checks 11-13): Tester follow-up.

## Verdict
Safe to merge once CI is green and the owner has seen finding 2/3. Deferred: sync-locales.yml, Weblate `website` component, #77 integration (help.* keys, help routes in the generator), approved-legal fixture, CJK line-break check.
