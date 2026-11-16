# Review: public pricing and contact pages (ut-docs#4963, #1434, #1453, #1454)

PR universaltill/ut-website#97. Independent combined Reviewer plus combined Tester (separate agents from the Dev).

## Tester (verdict: pass)
Built the site once and drove it: prices equal data/plan-prices.json (annual first, excl. VAT, two months free; GBP 8.33/24.17/40.83/100 per month, billed up front 100/290/490/1200), German TSE line only in the Germany panel, 200 with and without trailing slash, /support 301 to /contact, canonical and hreflang correct, no external requests, no horizontal scroll at 390px, fa-ir RTL fine, only allow-listed mailto addresses, paid CTAs go through the wizard.

## Reviewer (verdict: fix-first, one medium, now fixed)
1. Medium: `pricing.lede` said "never charged per till" next to the German per-main-till TSE line. Fixed: the sentence now names the TSE exception. Key stays `review: legal`.
2. Low: seat counts ("up to 2/5/50 people") and archive years are reused from the wizard/owner-decided entitlements; owner or legal to confirm they are live or hedged. Left as is, flagged.
3. Low: non-English locales show English fallback for the new keys (marked lang=en) and are in the sitemap with self-canonicals. Follow-up decision, not a defect.
4. Info: annual total is 10 x monthly (290), per-month x 12 would be 290.04; the page states 290, matching plan-prices.json annual_rule.
5. Privacy/security: mailto only, no new request, CSP untouched. SWA redirects: no loop.
6. #1453/#1454 (ut-cloud relay, auto-filing) are not built here; PR uses Refs, cards stay open.
Merge order: #97 first is acceptable; later PRs regenerate site/i18n-data.js and the SWA config and recompute the legal key count (114).
