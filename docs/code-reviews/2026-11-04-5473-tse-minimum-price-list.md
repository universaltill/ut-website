# Review: German TSE minimum term in the wizard and FAQ (ut-docs#5473)

Reviewer: independent Opus reviewer (code was written by a Sonnet dev agent; the
`wiz.price.tsemin` wording by an Opus legal pass, checked by an independent Sonnet
legal pass). Full record: ut-docs `code-reviews/2026-11-04-5473-tse-minimum-price-list.md`;
legal record: ut-docs `legal-reviews/2026-11-04-tse-minimum-price-list-5473.md`.

What shipped: `gen-plan-prices.mjs` copies `min_months_per_activated_till` into
`site/plan-prices.js` as `tseMinMonths` (fails on missing or non-positive-integer);
`wizard-rules.js` carries it only when a TSE line is priced; `wizard.js` adds the
`wiz.price.tsemin` line; `faq.a2` names the 12-month minimum (pinned to the JSON
by `tests/home-copy.spec.js`). English only, legal tier.

Findings and disposition:
- Medium, fixed: `guard-i18n-meta_test.mjs` legal-tier pin 63 -> 64 (new legal key),
  with a #5473 comment; `wiz.price.tsemin` added to the legal-classification list.
- Low, fixed: README home-copy note was stale (TSE exception "de-de only").
- Low, fixed (legal pass): "managed fiscal device (TSE)" in `wiz.price.tsemin`;
  "(optional, from Shop)" in `faq.a2` (en.json and site/index.html identical);
  tests and `site/i18n-data.js` regenerated.
- Low, accepted: no plural form for `{months}`; the value is 12.
- Deferred -> ut-docs#5485: headline "no minimum term" keys and `wiz.n.detse`.

Verification: `node --test scripts/*_test.mjs` 64/64; every non-network `ci.yml`
step rc=0; Playwright home-copy, wizard, wizard-rules: 97 passed.
