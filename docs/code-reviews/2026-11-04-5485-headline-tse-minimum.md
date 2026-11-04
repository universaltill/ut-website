# Review: Germany's managed-TSE exception in the headline "no minimum term" claims (ut-docs#5485)

Reviewer: independent Opus reviewer (code was written by a Sonnet dev agent; wording
checked by a legal pass, whose M1 and L3 were applied before this review). Legal
record: ut-docs `legal-reviews/2026-11-04-headline-tse-minimum-5485.md`; ut-docs side
also edits row 16 of `reference/merchant-terms-draft.md` (gate met for headline copy).

What shipped: every English headline "no minimum term" claim (`hero.lede`,
`why.exit.d`, `start.lede`, `meta.home.desc`) now names Germany's managed TSE line as
the exception in the same sentence; `why.exit.d` names the 12-month minimum per
activated main till. `why.exit.t` "No tie-in, ever." -> "No tie-in on your plan."
(legal M1). New key `wiz.n.detsemin` replaces `wiz.n.detse` (placeholder `{months}`
added, so a new key per the meta rules); `wizard.js` fills `{months}` from
`R.PRICES.de.tseMinMonths`. HTML fallbacks in `index.html` / `start.html` match
`en.json`; `site/i18n-data.js` regenerated; README home-copy note updated. English
only; no translated locale carries any affected key (they fall back to English).

Benchmark: merchant terms clause 6 - the plan has no minimum; only a separate line the
price list marks (today Germany's managed TSE, 12 months per activated main till)
keeps its own. The copy says that, no more (no "certified"/"compliant", no "no
contract") and no less (exception in the same sentence on every headline).

Pre-flight: check-i18n-keys OK (296 keys); guard-i18n-meta OK (483 keys, 64 legal) +
guard-i18n-meta_test 23/23; gen-locales --check up to date; guard-compliance-claims
(+_test) clean; guard-plan-names clean; guard-plan-prices (+_test) clean;
guard-mail-addresses clean; check-swa-config OK; check-documented-paths OK;
`CI=1 npx playwright test` (fresh build) 606 passed, 3 skipped, 0 failed; `npm run
build` puts the new copy in dist `llms.txt` / `llms-full.txt` / every locale's home.
No leftover `wiz.n.detse` outside historical review records and one explanatory test
comment.

Findings and disposition:
- Low, fixed: the legal-required M1 heading change had no test; a regression to
  "No tie-in, ever." passed the suite. `tests/home-copy.spec.js` now pins
  `why.exit.t` and its `index.html` fallback (mutation-checked: reverting the
  fallback fails the test).
- Low, accepted: `why.exit.d` holds "12-month" as literal text, not a placeholder;
  drift from `data/plan-prices.json` is caught by the home-copy test that reads the
  JSON.
- Low, accepted: `meta.home.desc` lost "Keeps selling offline" and "system" to stay
  within the 160-character cap (`seo-prerender.spec.js`); 157 characters, offline
  claim stays in the hero.
- Nit, accepted: `guard-i18n-meta_test.mjs` comment names the retired `wiz.n.detse`
  (explains why the legal count stays 64).

TDD re-verification (inline, reverted and restored in one turn): with `en.json`,
`en.meta.json`, `i18n-data.js`, `wizard.js`, `wizard-rules.js`, `index.html`,
`start.html` reverted to `main`, 5 tests fail (home-copy headline test, two
wizard-rules, two wizard UI tests); restored, all pass.

Tester attestation (summary): full suite 606/3 skipped/0 failed; guards green;
one-at-a-time mutations (each lede, `why.exit.d` tail, hero fallback, `{months}` fill,
price-file min 12 -> 6) each turn a test red, so tests are not false-pass; desktop
1280 and phone 360 screenshots show no horizontal overflow. Not looked at: other
locales (English-only change), dark theme, kiosk sizes. Pre-existing nit: phone hero
wraps "tie-/in" at the hyphen.

Verdict: approve.
