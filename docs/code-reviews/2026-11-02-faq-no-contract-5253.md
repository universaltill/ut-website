# 2026-11-02: "no contract" left the FAQ, meta description and /start (ut-docs#5253)

## What shipped

Follow-up L6 from the #4203 homepage-copy review. Three keys still claimed "no contract" in
all five locales (en-gb, tr-tr, zh-cn, fa-ir, de-de):

- `faq.a2`: home FAQ "Is it really free?". It also feeds the FAQPage JSON-LD and `/llms-full.txt`.
- `meta.home.desc`: home meta description. It also feeds `/llms.txt`.
- `start.lede`: the /start page lede.

A subscription is a contract, and annual billing exists. The only term we promise is the one
in `merchant-terms-draft.md`: no minimum term on monthly billing. Each key now says that, in
the phrasing the locale already uses in `hero.lede` and `why.exit.d`.

- The German `faq.a2` now names the legally required TSE, as `wiz.n.detse` does: the shop
  brings its own on Local and Local Plus, or uses ours from Shop, which has a 12-month minimum
  per main till.
- The English fallback text in `site/index.html` and `site/start.html` matches the dict.
- `meta.home.desc` stays within the 160-character cap that `seo-prerender.spec.js` enforces.
  To fit, en, tr, fa and de lost a few words of filler.

## Tests

These are new in `tests/home-copy.spec.js`:

- No dict value in any locale makes a "no contract"-type claim. The regex is broadened after
  review.
- The en-gb `faq.a2`, `meta.home.desc` and `start.lede` say "no minimum term on monthly
  billing".
- The de `faq.a2` names the TSE. Its months figure is read from `data/plan-prices.json`, so it
  is not typed twice. The de `start.lede` carries the TSE exception.
- The HTML fallback text equals the en-gb dict.

## Review

The author was Sonnet (a subagent). The independent reviewer was Opus 5.5, in a fresh context.

| # | Sev | Finding | Outcome |
|---|---|---|---|
| M1 | med | de `start.lede` and `meta.home.desc` promise "keine Mindestlaufzeit" without the managed-TSE 12-month exception, and neither page shows the `why.exit.d` caveat | **Fixed** in `start.lede`: "(die verwaltete TSE ausgenommen)", with a test. **Accepted** in `meta.home.desc`: it is at the 160-character cap. This follows the #4203 de hero precedent, and the page it links to states the exception in `why.exit.d` and the FAQ. |
| L1 | low | de "Pakete" where the dict says "Tarif" | **Fixed:** "Bezahlte Tarife" |
| L2 | low | tr "paketlerde" where the dict says "plan" | **Fixed:** "Ücretli planlarda" |
| L3 | low | zh "套餐" where the dict says "方案" | **Fixed:** "付费方案" |
| L4 | low | fa sentence had no verb, and "پلن" where `free.body` says "طرح" | **Fixed:** "طرح‌های پولی در پرداخت ماهانه حداقل مدت قرارداد ندارند." |
| L5 | low | de "12 Monate" was hard-coded, with no test against the price file | **Fixed:** the test reads `min_months_per_activated_till` |
| L6 | low | The no-contract regex missed other phrasings ("contract-free", "sözleşmesiz", "无需合同", …) | **Fixed:** the regex is broadened. It still scans the dict only. The HTML fallbacks are pinned to the dict by the equality test. |
| — | note | en/tr/zh meta descriptions no longer say "open source" | **Accepted.** This is an SEO choice forced by the length cap. The FAQ still says it. |

## Verification

- **TDD:** checked by the orchestrator. With `origin/main`'s `site/` files restored and the
  new tests kept, 2 tests failed with the expected messages: `faq.a2` was missing "no minimum
  term on monthly billing", and en-gb `meta.home.desc` matched the no-contract regex. The
  third, the fallback-equality test, passed because the old dict and HTML agreed, and it now
  pins them together. With `site/` restored, 15/15 `home-copy` tests passed.
- **Gate after the fix round, all PASS:**
  - `check-i18n-keys` (5 locales, 291 keys)
  - `guard-compliance-claims`, `guard-plan-names`, `guard-plan-prices`, `guard-mail-addresses`
  - `check-documented-paths`, `check-swa-config`
  - `astro build` + `postbuild` + `generate-csp --check`
  - full `npx playwright test`: **533 passed**
- **Visual:** this is a text-only change. The existing 360px no-overflow assertion in
  `home-copy.spec.js` passes for every locale. No screenshots were taken.
- **Translations:** checked by the model only. There was no native-speaker review.
- **Legal:** this is marketing copy, not terms text. It narrows a claim to match the terms
  draft and adds no new promise. No `legal-reviews/` record.

## Verdict

Safe to merge.
