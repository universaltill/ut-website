# Review — "Find your setup" wizard (ut-docs#4193)

Date: 2026-10-23. Built by Sonnet 5.5; independent review by Opus 5.5; findings fixed by a second Sonnet pass; the parent re-ran the suite.

## What shipped

`/<locale>/find-your-setup` in en, de, tr, fa, zh: six optional questions, then a recommended plan with its price (excl. VAT), why, hardware, plugins, an honest "Not yet" list, and next-step buttons. Free local app goes to `/<locale>/download`; the cloud goes to `https://my.universaltill.com/<locale>/` (zh-cn maps to en-gb, the closest locale my. serves). A no-JS fallback keeps both links on the page. Linked from the home hero and the nav on every page. Rules live in one table, `site/wizard-rules.js`. Answers stay in memory: nothing stored or sent.

## Findings (independent review) and outcome

| # | Severity | Finding | Outcome |
|---|---|---|---|
| B1 | Blocker | Germany + Local Plus showed the EUR 12 managed-TSE line, which only starts at Shop | Fixed, tested |
| B2 | Blocker | "Other euro country" + fiscal device said no fiscal device is required (false for AT, IT, PT, GR, HR) | Fixed: honest "Not yet" line, no legal claim; test |
| H1 | High | Germany with no fiscal tick never mentioned the legal TSE duty | Fixed, tested |
| H2 | High | Prices not labelled excl. VAT | Fixed in 5 locales, tested |
| M1 | Medium | Plan raised for features that don't exist (accountant/phone support, Booksy, online ordering) | Fixed: those show as "coming" in Not yet and don't raise the plan |
| M2 | Medium | German own-device note contradicted the plan for several sites / online | Fixed |
| M3 | Medium | zh-cn link went to a path my. doesn't serve | Fixed, test corrected |
| M4 | Medium | Skipped country gave "price not published" | Fixed |
| L | Low | Privacy wording vs GA4, aria-describedby/live region, fa digits, tr question wording | Fixed; GBP 70 hardware price kept (only GBP figure exists) |

## Verified beyond the tests

Reviewer mutation test: breaking the cloud link or the free-app link failed 10 tests in every locale. All prices re-checked against `ut-docs/reference/subscription-plans.md`. Rendered at 360px and 1024x600 in de/fa/zh. Parent re-ran: Playwright 449 passed; i18n keys OK; plan-names guard OK (GNU grep).

## Open for the owner

- Publish plan prices on the public site? (`subscription-plans.md` wants the approved compliance wording, ut-docs#667, first.) This PR stays draft until answered.
- Native read of the German and Turkish wording.
- `online` no longer raises the plan to Shop; the plans doc lists a hosted digital menu under Shop. Reconsider.
- Not built: consent-based lead capture (#2550), instant browser start (#4191), partner routing for "talk to us".

## Verdict

Safe to merge once the owner confirms publishing prices.
