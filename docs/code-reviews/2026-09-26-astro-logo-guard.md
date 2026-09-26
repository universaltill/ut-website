# Review — Astro logo sizing guard (ut-docs#476)

**Branch:** `fix/476-astro-logo-guard` · **Reviewer:** independent subagent on a
different model from the author · **Date:** 2026-09-26

## What shipped

Most of #476 had already landed through later work: Tailwind is gone, the
Playwright web server builds and serves `dist/`, `tests/astro-pages-nav.spec.js`
drives `/blog` and `/plugins` against the real Astro output, and
`BaseLayout.astro` uses the same 22x30 / 19x26 logo pair as `site/*.html`.
This change closes the two gaps that were still open:

- `scripts/check-brand-assets.sh` checks the logo `<img>` ratio in
  `src/**/*.astro` too (it only globbed `site/*.html`), and fails if either
  tree yields zero matched logos, so a markup change can't make it pass by
  checking nothing. `BRAND_ASSETS_ROOT` lets a fixture test point it at a
  temp tree.
- `scripts/check-brand-assets_test.sh` (new, run in the `check-brand-assets`
  CI job): a correct pair passes; the 34x30 pair that shipped fails and names
  the Astro file; an unmatched layout fails with its reason.
- `tests/site-consistency.spec.js` compares the **rendered** header and
  footer logo boxes on each Astro page against the homepage, not only the
  attributes, and asserts they are non-zero.

## Findings

| # | Severity | Finding | Outcome |
|---|---|---|---|
| 1 | minor | Zero-match sentinel covered Astro only; `site/*.html` drifting off the pattern would pass vacuously | Fixed — `html_checked` counter |
| 2 | minor | Comment overclaimed: `img{height:auto}` on a correct 22x30 pair rounds to the same box, so the box check alone doesn't catch that rule | Fixed — comment reworded (the attribute check catches the #476 pair; the box check catches CSS sizing rules) |
| 3 | minor | Both logos hidden would compare `{0,0}` to `{0,0}` | Fixed — `> 0` height assertions |
| 4 | minor | Greedy `sed` takes the last `width=` on a line; two tags joined on one line could hide a bad pair | Accepted — one tag per line holds in every file today |
| 5 | nit | `grep -r` with a single file omits the filename in messages | Fixed — `-H` |
| 6 | nit | "unmatched layout" case only checked the exit code | Fixed — asserts the message |

## Verified beyond the automated run

- Full suite `CI=1 npx playwright test`: 174 passed, after the fixes.
- Box check proven live: injecting `<style is:global>img{width:auto;height:auto}</style>`
  into `BaseLayout.astro` failed all three "same chrome" tests on the new
  `logoBox` assertion while the attribute assertion above it still passed;
  restored, green.
- Guard self-test proven live: with the pre-change `check-brand-assets.sh`
  restored, `check-brand-assets_test.sh` fails ("a landscape 34x30 pair in
  src/**/*.astro must fail"); with the change, OK.

## Verdict

Safe to merge.
