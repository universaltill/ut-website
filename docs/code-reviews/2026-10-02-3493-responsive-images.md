# Review — ut-docs#3493: responsive screenshots, WebP, LCP priority, language-pill name

**Date:** 2026-10-02 · **Branch:** `perf/3493-responsive-images` · **Built by:** Claude Opus 5.5 · **Reviewed by:** Claude Fable 5.1 (independent subagent)

## What shipped

- `scripts/make-image-variants.sh` (cwebp) → `<name>-640.webp` / `-1024.webp` per screenshot, committed; `plugin-store.png` → WebP (PNG removed).
- `site/index.html`: `srcset` + layout-matched `sizes` on all 11 screenshots; hero LCP image `fetchpriority="high"`.
- Language pill: accessible name `"<LOCALE> — <Language>"` contains the visible text (Lighthouse `label-content-name-mismatch`, WCAG 2.5.3) — in `i18n.js`, the build-time prerender (`marketingPages.ts`) and `BaseLayout.astro`.
- Tests: `tests/responsive-images.spec.js` (variants exist with true widths; sharp-and-not-oversized invariant at 390/1280/1920 × DPR 1/2; LCP priority; pill name in browser and raw HTML). `mobile-nav.spec.js` label expectations updated.

## Findings

| # | Sev | Finding | Outcome |
|---|---|---|---|
| 1 | MAJOR | Hardware image `sizes` assumed the 1120px cap, but `.band` has none → blurry at 1280–1920px | **Fixed** — `calc(50vw - 58px)`. |
| 2 | MAJOR | No test of "picked candidate ≥ drawn px × DPR" | **Fixed** — invariant test; it failed on #1 before the fix (`till-tiles-7in-1024.webp drawn at 1163px`). |
| 3 | MINOR | Gallery `360px` over-estimates (real ≈331px) | **Fixed** — `calc((min(100vw, 1120px) - 128px) / 3)`. |
| 4 | MINOR | Pill label right only after JS | **Fixed** — set at build (prerender + BaseLayout), raw-HTML test added. |
| 5 | MINOR | README silent on variant script | **Fixed**. |
| 6 | NIT | Pre-existing: lazy hardware image lays out 2px wide ≤900px until loaded (CLS) | Deferred — Backlog card. |
| 7 | NIT | RTL label order | Accepted (containment satisfies 2.5.3). |

## Verified

- TDD: `responsive-images.spec.js` failed 4/4 before the change; invariant test failed on the review's bug before fix #1.
- Lighthouse (local build, no compression): page weight 794 KiB → 334 KiB; desktop 100/100/100/100, image-delivery savings 707 → 58 KiB (rest is the uncompressed local server). A one-off mobile CLS 0.258 did not reproduce in 4 re-runs (0–0.001).
- Gate: build, check-i18n-keys, check-swa-config, generate-csp --check, site/→dist byte-identical, `npx playwright test` **213 passed**.
- Looked at: `/fa-ir` gallery at 390px and 1280px (RTL), sharp, no overlap. Not looked at: dark theme (no style change).

## Verdict

Safe to merge after fixes 1–5 (all done).
