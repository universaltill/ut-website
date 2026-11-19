# Review: partner privacy notice page + gated link (ut-docs#6277 item 2), ut-website

Date 2026-11-19. Part of ut-docs#6277 (stays open). Three PRs: ut-website#110, ut-partner-app#22, ut-cloud#1090, all flags OFF by default.
Reviewers: first pass Sonnet 5.5, independent second pass Opus 5.5 (different model from the dev, which was Sonnet 5.5), Tester run separate from Dev. Full reports: ut-docs temp folder of the lane (temp/partner-gate-6277/{tester,reviewer,reviewer-opus}-report.md).

## What shipped
Own `partnerNotice` collection + route /{lang}/partner-privacy/, emitted only while `PARTNER_PRIVACY_PAGE_LIVE` (src/lib/partnerPrivacy.ts) is true (committed: false). noindex, in no sitemap/llms/nav/footer/in-app legal route. Text = DRAFT section 1 of ut-docs reference/partner-support-contact-notices-draft.md, verbatim (tester diffed programmatically: 4/4 paragraphs).

## Findings
| # | Sev | Finding | Outcome |
|---|---|---|---|
| F1 | important | DRAFT-marker assertion unconditional: the go-live flip PR could not go green | Fixed: required only while not live |
| O1 | important | 4 more gate tests assert flag==false / OFF build; the flip as documented fails CI | Fixed: those tests skip when LIVE; new LIVE-only test guards noindex, no sitemap/llms. Mutation run (flag true, DRAFT removed): green |
| F2 | important | `//` comment in plain() swallowed the `&amp;`/whitespace normalisation | Fixed |
| O2 | medium | header language picker on the English-only page led to a 404 (/de-de/partner-privacy/) | Fixed: every locale emits a noindex English fallback (canonical en-gb, legalEnglish band, ltr/en attrs), like legal/[slug] |
| F6/O7 | note | noindex via meta, own collection, env switch needs UT_OUT_DIR, CSP unchanged, ubuntu-latest | accepted, verified |

## Verification
Gate test 11 tests (10 pass, 1 skipped when OFF); Playwright 1250 passed, 1 skipped; locale/guards OK (tester). TDD re-proved by the Opus reviewer in scratch worktrees: without the implementation ERR_MODULE_NOT_FOUND; lib-only 4 fail / 6 pass; mutation run proves the OFF suite catches a leaked page. Driven browser run (360px, RTL stress, dark, keyboard): pass; the site has no dark theme.

Pre-flight: price n/a; capability claim n/a; till behaviour n/a; new en.json key n/a here (ut-cloud); partner UI help topic deferred to the go-live PR (needs a Backlog line on #6277); ADR n/a; plugin n/a; review record: this file.

## Verdict
Approved after fixes. Not verified: screen reader (VoiceOver/NVDA). Deferred: add curl 200 + noindex check and help-topic sentence to the #6277 go-live checklist; text approval by owner/counsel (ut-docs#6738) before the flag flips.
