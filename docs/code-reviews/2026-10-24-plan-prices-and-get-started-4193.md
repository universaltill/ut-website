# Review: new plan prices, single price source, every Get started opens the wizard (ut-docs#4193)

Date 2026-10-24. Branch feat/4193-setup-wizard (PR #69). Built by Sonnet 5.5; reviewed by an independent Opus agent.

## What shipped
- Prices (owner 2026-10-24): Local 0, Local Plus 10, Shop 29, Pro 49, Multi-location 120, extra location 33 (to 10), annual per month 8.33 / 24.17 / 40.83 / 100.00, Germany +EUR 12 per main till (Shop and up, never discounted). UK in GBP, eurozone and Germany in EUR. Other countries show "not published yet".
- One source: `data/plan-prices.json` (copy of ut-docs `reference/plan-prices.json`) -> `scripts/gen-plan-prices.mjs` -> `site/plan-prices.js` -> `wizard-rules.js`. No amount typed in site/ or src/.
- `scripts/guard-plan-prices.sh` (+ test): retired prices (42/59/127, 35.00/49.17/105.83) in site/ or src/, stale generated file, optional identity with ut-docs main.
- Every Get started (nav, hero, 404, every page, Astro layout) -> `/<locale>/find-your-setup`; the redundant "Find your setup" nav links and key `nav.setup` removed; offline-pos blog post CTA in 5 locales.
- Partner / referral wording: none exists on the site (all locales, blog), nothing to change.

## Review findings
- F1 high: vendored file used an invented schema. Fixed: now the ut-docs draft's own schema (minor units), copied byte-identical, converted by the generator.
- F2 high (security): a DOCS_READ_TOKEN for private ut-docs in a public repo's CI. Removed. Equality check runs locally via PLAN_PRICES_UPSTREAM and from the ut-docs side (card filed).
- F3 medium: regex missed `EUR 59`, `EUR59`, `EUR 59.00` and prefix decimals. Fixed + tests.
- F4 medium: guard passed silently without GNU grep. Now exits 2.
- F5 medium, product, NOT changed: no wizard rule ever recommends Pro, and Shop appears only in Germany. Existing rule table; owner question.
- F6 low: TSE line now says it is not discounted, also on annual billing (5 locales).
- F7 low: offline-pos blog CTA now opens the wizard; the "getting-started guide" links in multiple-tills posts stay on /start (a guide, not a CTA).
- F8 nit: left.

## Verified
build; 503 Playwright tests (all 5 locales, German TSE line, Persian digits, phone 360 px, keyboard); i18n key guard; plan-names and compliance guards (GNU grep); CSP check; reviewer recomputed every displayed number for UK/DE/EU. Looked at: German wizard result phone, Persian wizard result desktop (RTL), English home phone, German home desktop. Not looked at: tr-tr and zh-cn rendering by eye, real touch hardware, screen reader.
