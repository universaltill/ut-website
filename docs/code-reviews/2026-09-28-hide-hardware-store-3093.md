# Review: hide the hardware store (ut-docs#3093)

**Date:** 2026-09-28 · **Branch:** `fix/3093-hide-store` · **Built by:** Opus 5.5 · **Reviewed by:** Fable (independent subagent)

## What shipped
The product owner asked for this: `store.universaltill.com` doesn't exist and there is no device to sell yet.
- Removed from the site:
  - the nav "Store" link (`site/index.html` and `src/layouts/BaseLayout.astro`);
  - the homepage `#store` section;
  - the "Or buy a ready-made kit" button;
  - the start page's "Buy a ready-made kit" link to `store.universaltill.com`.
- Four strings reworded without the store clause, in en/tr/zh/fa/de. The unused keys are deleted: `nav.store`, `store.*`, `storep.*`, `hw.photo`, `get.buy`, `start.buy`.
- `site/store.html` is moved to `docs/archive/store.html` (unpublished, with restore steps in its header). The six store routes are now 301 redirects to the locale home, and the sitemap drops it automatically.
- `tests/no-store-link.spec.js` guards against a store link coming back; mobile-nav and legal-pages specs are updated.

## Findings
| # | Severity | Finding | Outcome |
|---|---|---|---|
| 1 | minor | The guard missed `L('/store')`, trailing-slash, sub-path, `store.html` and absolute-URL forms | Fixed: one wider pattern (the SWA config is exempt; it has its own redirect test). Checked against 6 positive and 4 negative samples |
| 2 | info | Nothing left in `dist/`; the sitemap has no store entry; plugin store / Play Store wording is untouched | none needed |
| 3 | info | i18n: 199 keys per locale, all `data-i18n` keys resolve, and the reworded strings end cleanly in all 5 locales | none needed |
| 4 | info | SWA config is valid JSON with 301s and no route shadowing | none needed |

## Verified beyond automated tests
- The guard spec failed first (9/9 red), then passed.
- Homepage and start page at 1280 and 360 (en + de) were looked at: no empty gap where the section was.
- The full suite passes 174/174. Also green: `check-i18n-keys`, `check-swa-config`, `guard-compliance-claims`, `generate-csp --check`, `download-redirects_test`.

## Verdict
Safe to merge.

## Deferred
Restoring the store is a new card once a device exists; the steps are in `docs/archive/store.html`.
