# Review — EPOS / till-system keywords, home FAQ + FAQPage JSON-LD (ut-docs#4320)

**Date:** 2026-10-14 · **Reviewer:** independent subagent (Fable 5.1; code written by Opus 5.5) · **Verdict:** safe to merge after fixes (applied)

## What shipped
- `site/i18n.js`: home + download titles/descriptions, hero H1, `sol.title`, `foot.tagline` use the words shops search for (EN: free EPOS, till system, POS; DE: kostenloses Kassensystem, Kassensoftware; TR/ZH/FA equivalents). New `faq.*` keys (title, sub, 6 Q/A) in all 5 locales.
- `site/index.html`: `#faq` section, native `<details>` (keyboard/touch/screen reader without script).
- `site/styles.css`: FAQ styles, logical properties (RTL), 44px+ summary target, visible focus.
- `src/lib/marketingPages.ts`: `faqJsonLd()` emits one `FAQPage` JSON-LD per locale page from the same dict keys as the visible FAQ.
- Keyword → page map: `ut-docs/reference/website-keyword-map.md`.
- Tests: `tests/seo-prerender.spec.js` — EPOS/Kassensystem in raw titles/H1, FAQ JSON-LD = visible text per locale, no FAQPage on download, title ≤ 60 / description ≤ 160 in every locale.

## Findings
| # | Severity | Finding | Outcome |
|---|---|---|---|
| 1 | Medium | tr (178), fa (170), de (166) home descriptions over Google's ~160 cut — the truncated tail was the "no monthly fee" hook | Fixed; length test added |
| 2 | Low | de description: software "verkauft" — unnatural | Fixed (reworded) |
| 3 | Low | fa `faq.a4` verbless fragment; tr "70£'dan" not idiomatic | Fixed |
| 4 | Low | CSS `::after` "+"/"−" read aloud by screen readers | Fixed (`content: "+" / ""`) |
| 5 | Info | Client-side language switch keeps the first locale's JSON-LD in `<head>` | Accepted: crawlers fetch the prerendered locale URL |

Pre-review self-check also caught an overclaim: the first "Is it really free?" answer said you pay only for hardware and card fees. `ut-docs/reference/subscription-plans.md` (owner, 2026-10-14) has paid optional cloud plans and German TSE costs, so the answer now says the till is free forever on the shop's own hardware and optional cloud extras (DE: and legally required services such as a TSE) may cost extra.

All facts restate existing site copy or the product's own `import.help` string (verified by the reviewer word for word). Compliance-claims guard: no legal outcome promised.

## Verification
- Full Playwright suite green (324 incl. this card's 8); `check-i18n-keys`, `guard-compliance-claims`, `generate-csp --check` OK; ld+json needs no CSP hash.
- TDD re-verified by the reviewer: reverting `marketingPages.ts` fails the 5 per-locale JSON-LD tests (0 FAQPage blocks); restored → pass.
- Looked at: FAQ at 360×780 (en), 1024×600 (de, longest), 1350×900 (en), 1024×700 (fa RTL — "+" on the left, text right-aligned). No horizontal overflow; summary height 53px; Enter on focused summary opens it. Not checked: real touch hardware (native `<details>`, no pointer handlers).
- Note: Google shows FAQ rich results only for government/health sites since 2023 — the value is visible answers in shoppers' words plus machine-readable Q&A for AI tools.

## Deferred
None new. Related open cards: #4319 (llms.txt), #4321 (shop-type pages), #4322 (Bing/IndexNow/listings), #3481 (Organization JSON-LD).
