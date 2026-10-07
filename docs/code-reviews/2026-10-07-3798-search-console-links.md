# Review — ut-docs#3798: Search Console indexing (links, slashes, raw templates, apex)

**Date:** 2026-10-07 · **Branch:** `fix/3798-search-console-links` · **Built by:** Claude Opus 5.5 · **Reviewed by:** Claude Fable 5.1 (independent subagent, own worktree)

## What shipped
- `src/lib/marketingPages.ts` — `localizedHref()`: the per-locale prerender rewrites the templates' unprefixed links (`/download`, `/legal/privacy`, `/`) to final URLs (`/de-de/download`, `/de-de/legal/privacy/`, `/de-de`). Before this, each one was a 301 and the legacy redirects all land on `/en-gb`, so **a German visitor clicking Download was dropped into English**. Language-picker links get `rel="nofollow"` and a build-time `?from=`.
- `site/i18n.js` — on a no-reload language switch, links in the previously shown language follow the new one; deliberate other-language links (a post's "Read the English original") are left alone. `stripLang` keeps a trailing slash.
- Astro pages (`BaseLayout`, blog, plugins, legal, RSS) link and declare hreflang in the trailing-slash canonical form; the slashless form answers 200 as a duplicate.
- `staticwebapp.config.json` — raw templates `/index.html`, `/download.html`, `/start.html`, `/pilot.html`, `/language.html` 301 to `/en-gb/…`; legacy `/blog`, `/plugins`, `/legal/*`, `/blog/*` redirects now land on the slash form.
- `scripts/translate-posts.js` — a translation linking its own locale (`/tr-tr/download` for English `/en-gb/download`) is the same target.
- `deploy.yml` — post-deploy live check: apex → 301 www (the SWA *default domain*, portal-only: `isDefault` is not in the public ARM spec, checked `Microsoft.Web/AppService/stable/2026-07-15/openapi.json`), `/` → 301 `/en-gb`, `/index.html` → 301 `/en-gb`, `/en-gb` → 200; the staleness check reads `latest.json` from www.
- New `tests/internal-links.spec.js`: every sitemap page's raw links, canonical and hreflang must answer 200 directly **and** be their own canonical; every SWA redirect must land on such a page; no-reload switch and English-original behaviour.

## Findings
| # | Sev | Finding | Outcome |
|---|---|---|---|
| M1 | Medium | Legacy `/blog`, `/plugins`, `/legal/*`, `/blog/*` redirects landed on slashless duplicates — the URLs Google already holds | **Fixed**; new redirect-chain test (failed first, 6 cases) |
| M2 | Medium | `/index.html` route can't be proven locally (SWA docs: an `/index.html` route also matches `/`) | **Fixed**: live check asserts `/`, `/index.html`, `/en-gb`. Safe by construction: `/` already 301s to `/en-gb`, the same target, so no loop |
| L1 | Low | i18n.js rewrite corrupted hrefs if `<html lang>` isn't a supported locale (`/de-de-gb/…`) | **Fixed** (guard on `supported`) |
| L2 | Low | `localizedHref` re-homed deliberately prefixed links | **Fixed** — prefixed links untouched |
| L3 | Low | `/blog/rss.xml` treated as an asset | Accepted — no template links it; the crawl test would catch it if one did |
| L4 | Low | A typed slashless URL carries a slashless `?from=` | Accepted — unreachable via any link |
| L5 | Low | Live check had no retry | **Fixed** (`--retry 3 --retry-all-errors`) |

Reviewer confirmed: existing tests updated faithfully, none weakened; CSP hashes unchanged; no other reader of the apex host remains.

## Verified beyond automated tests
- TDD re-verified by the reviewer (two mutations: disabling `localizedHref` → 5 tests fail; reverting a BaseLayout slash → duplicate detected) and by me (BaseLayout slash, i18n loop disabled).
- Driven in Chromium: `/de-de` → Download lands on `/de-de/download` (`lang=de-DE`, German heading); footer privacy → `/de-de/legal/privacy/`; `/fa-ir` hero pilot link → `/fa-ir/pilot` (`dir=rtl`); fa-ir homepage screenshot read — layout unchanged (only hrefs changed). Not looked at: dark theme / phone widths (no visual change).
- Live check script run locally against production: fails only on the two not-yet-live items (apex default domain, `/index.html` route).

## Gates
check-i18n-keys OK · check-swa-config OK · translate-posts 11/11 + 0 problems · compliance guard OK · build OK · generate-csp --check OK · Playwright **255 passed**.

## Owner action
Azure portal → `unitill-website` → Custom domains → `www.universaltill.com` → **Set default**. Until then the post-deploy check is red by design.

**Verdict:** safe to merge.
