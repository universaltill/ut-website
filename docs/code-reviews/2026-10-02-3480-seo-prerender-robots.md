# Review — ut-docs#3480: robots.txt + per-locale prerender of the marketing pages

**Date:** 2026-10-02 · **Branch:** `feat/3480-seo-prerender-robots` · **Built by:** Claude Opus 5.5 · **Reviewed by:** Claude Fable 5.1 (independent subagent)

## What shipped

- `site/robots.txt` — allow all, `Sitemap: https://www.universaltill.com/sitemap.xml` (was a 404).
- `src/lib/marketingPages.ts` + `src/pages/[lang]/[file].ts` — at build, each
  `site/*.html` template is rendered once per locale with the `site/i18n.js`
  dict applied (parse5): `<html lang dir>`, every `data-i18n*` string,
  `<title>`/meta description (new `meta.<page>.title/.desc` keys, all 5
  locales), a self-referencing canonical and the full hreflang set (indexable
  pages only). Output `dist/<locale>/<page>.html`.
- `site/staticwebapp.config.json` — locale routes rewrite to `/<locale>/<page>.html`.
- `i18n.js` + `check-i18n-keys.js` — `data-i18n-content` support.
- `sitemap.xml.ts` now reads its marketing routes and noindex decision from `marketingPages.ts`.
- Tests: `tests/seo-prerender.spec.js` (raw, JS-free response for every locale route; robots.txt; client-side switch; `data-i18n-html` round-trip).

## Findings

| # | Sev | Finding | Outcome |
|---|---|---|---|
| 1 | MINOR | `/de-de/index.html`, `/de-de/` etc. also answer 200 on Azure (plain files) | Accepted — every copy carries a canonical to the pretty URL and none is in the sitemap; the root `/index.html` already behaved this way. |
| 2 | MINOR | noindex/route derivation duplicated between sitemap and prerender | **Fixed** — sitemap imports `marketingRoutes`/`isNoindex` from `marketingPages.ts`. |
| 3 | MINOR | no test for client `data-i18n-content` or `data-i18n-html` prerender | **Fixed** — two tests added. |
| 4 | NIT | `about.body` `<strong>` inside plain `data-i18n` never rendered bold | Pre-existing, accepted. |
| 5 | NIT | parse5 serialization cosmetics (`defer=""`, collapsed doctype line) | Accepted, harmless. |
| 6 | NIT | `parse5` in `dependencies` not `devDependencies` | Accepted — same place as `astro`, both build-time. |

Security: the dict `eval` is build-time over repo content, same as the existing
`check-i18n-keys.js`; CSP unchanged (inline script bytes identical, `generate-csp --check` OK).

## Verified

- TDD: `seo-prerender.spec.js` written first and failed against the old build (robots 404, `lang="en"` on `/en-gb`).
- Full gate: `npm run build`, `check-i18n-keys`, `check-swa-config`, `generate-csp --check`,
  site/→dist byte-identical loop, `translate-posts`, `guard-compliance-claims`, `npx playwright test` — **202 passed**.
- Driven in Chromium: `/fa-ir` (1280px, RTL, Persian title/canonical), `/de-de/start` (390px),
  `/zh-cn/download` — rendered correctly, zero console/CSP errors; picker switch `/de-de` → `/tr-tr`
  updates lang/title. Not looked at: dark theme (no theme change in this diff).
- Translations checked against neighbouring terms in each dict (reviewer + author).

## Verdict

Safe to merge.

## Deferred

- ut-docs#3481 — OpenGraph/Twitter, Organization/SoftwareApplication JSON-LD, apex→www 301.
- ut-docs#3482 — visitor analytics (owner decision).
