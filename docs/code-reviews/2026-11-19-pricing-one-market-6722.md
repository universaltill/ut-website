# Pricing: one market per page (ut-docs#6722)

Owner 2026-11-19: no market tabs; each page shows only its own country's prices. Prices unchanged.

**Mapping (decided from the published-locale list; the URL locale is the country):**
en-gb -> UK (GBP); de-de -> Germany (EUR, TSE line); el-gr, es-es, fr-fr, it-it, pt-pt -> Eurozone (EUR);
ar-sa, fa-ir, ms-my, tr-tr, zh-cn -> no priced market: free Local + Talk to us, no amounts.
Code: `marketOf` in `src/lib/pricing.ts`; `pricing.js` and the picker removed.

**Tester (fresh agent):** full suite 1246 passed / 0 failed; plan-price guard clean; driven run with
screenshots of /en-gb, /de-de, /fr-fr, /tr-tr at 1280 and 360px (one market, correct currency, no tabs);
mutation (tr-tr -> uk) failed two specs, reverted.

**Reviewer (fresh agent) findings, all fixed:** lede said TSE "shown below" on every page (reworded to
"shown on the German page"); README stale (updated); dead `.price-other` CSS (removed); unpriced panel
had no h2/aria-label (added); weak test loop / no currency-symbol check on unpriced locales (fixed).
Left: unused key `pricing.market.label` (Weblate cleans it); "Change region" link skipped (needs a new key).

**Other price mentions:** the wizard asks the visitor's country and shows only that market (already
per-market). Home FAQ and `wiz.hw.need` quote "about £70" for a DIY till: a hardware estimate, not a plan
price, left as is and flagged to the owner.
