# Review — wizard recommends Shop and Pro from the plan rules data (ut-docs#4962)

**Branch:** `feat/4962-wizard-plan-rules` · **Author:** Sonnet 5.5 (Dev) · **Reviewer:** Opus 5.5, independent different-model review · **Tester:** Opus 5.5, PASS · **Date:** 2026-11-16

Pre-flight: prices unchanged · new strings English only (en.json + en.meta.json), removed `wiz.o.needs.team` from every locale · README wizard section updated · CSP unchanged (same-origin script).

Full record (outcomes vs the ladder, findings R1–R5, D1, every command run): ut-docs `code-reviews/2026-11-16-wizard-plan-rules-4962.md`.

## Findings in this repo
| # | Severity | Finding | Outcome |
|---|---|---|---|
| R1 | Low | `wiz.o.needs.archive` names a retention period but was `review: standard` | Fixed: `legal`; guard-i18n-meta test count 72 → 73 |
| R4 | Low | An Enterprise result also lists the Multi-location people reason | Accepted: reasons are floors, as for `remote` |
| D1 | Low | fa-ir: English fallback text in wizard labels is bidi-reordered | Pre-existing; evidence added to ut-docs#5424 item 2 |

## Verified
- Tester: 11 mutations each turn a test red; exhaustive check (384k answer sets) that a `built:false` rule never changes plan, price or reasons; driven run at 360×800 and 1280 (Pro £49 via people 3–5, Shop £29 UK via people 1–2, 11 needs checkboxes ≥44px, fa-ir RTL); full `npx playwright test`: 649 passed, 3 skipped.
- Reviewer: every ci.yml command, wizard specs 111 passed after the fixes.

## Verdict
MERGE.
