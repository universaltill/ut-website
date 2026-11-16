# Legal pages for live payments (card #6063, PR ut-website#93)

## What shipped
The merchant-facing legal pages needed before the first live payment: new `subscription-terms.mdx` and
`refunds.mdx`, updated `privacy.mdx` and `terms.mdx` (all en-gb), a `site/staticwebapp.config.json` routing
addition and `tests/legal-pages.spec.js`. The subscription terms URL is `/en-gb/legal/subscription-terms/`
and the refund policy URL is `/en-gb/legal/refunds/` (plural); the live billing PR uses these.

## Review
Legal text: reviewed by Fable 5.2 in the legal role (approved with edits, edits applied); the legal review
record and owner sign-off live in ut-docs#6064 / card #6063 (legal text sign-off is delegated to Fable, owner
2026-11-12). Code and tests: this branch is content plus its Playwright and unit tests.

## Verification (real runs)
Playwright: 626 passed, 1 failed, 3 skipped on the first run; the single failure was
`topics the owner excluded are not published` (claim returned 200) because the branch predated the help
deny-list fix (website#95). Main was merged into the branch (no conflicts); CI is green on the new head
(Playwright, unit tests, commit-attribution, build).

Pre-flight: legal text n/a to ut-cloud locales (website only); plan/price n/a; README n/a.

## Verdict
Approve. Deferred: none. Publishing and deploy follow the merge; the live payments PR uses the refunds URL.
